-- ================================================
-- DISPATCH MODULE REDESIGN MIGRATION
-- ================================================
-- This migration adds:
-- 1. QC Feedback table for picker notifications
-- 2. Trolley labels for scan-to-pick workflow
-- 3. Columns for split picking support
-- 4. Columns for haulier internal/external tracking
-- 5. Load color coding
-- ================================================

-- ================================================
-- QC FEEDBACK TABLE
-- ================================================
-- Tracks quality control feedback from manager to picker

CREATE TABLE IF NOT EXISTS public.qc_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  pick_list_id uuid NOT NULL,
  pick_item_id uuid,

  -- Feedback details
  issue_type text NOT NULL CHECK (issue_type IN (
    'wrong_item',
    'wrong_qty',
    'quality_issue',
    'missing_label',
    'damaged',
    'other'
  )),
  notes text,
  action_required text CHECK (action_required IN ('repick', 'relabel', 'accept')),

  -- Resolution tracking
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text,

  -- Picker notification
  picker_notified_at timestamptz,
  picker_acknowledged_at timestamptz,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,

  CONSTRAINT qc_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT qc_feedback_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT qc_feedback_pick_list_id_fkey FOREIGN KEY (pick_list_id)
    REFERENCES public.pick_lists(id) ON DELETE CASCADE,
  CONSTRAINT qc_feedback_pick_item_id_fkey FOREIGN KEY (pick_item_id)
    REFERENCES public.pick_items(id) ON DELETE SET NULL,
  CONSTRAINT qc_feedback_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT qc_feedback_resolved_by_fkey FOREIGN KEY (resolved_by)
    REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_qc_feedback_pick_list ON public.qc_feedback(pick_list_id);
CREATE INDEX idx_qc_feedback_unresolved ON public.qc_feedback(org_id)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_qc_feedback_picker_pending ON public.qc_feedback(org_id, picker_acknowledged_at)
  WHERE picker_acknowledged_at IS NULL AND picker_notified_at IS NOT NULL;

-- ================================================
-- TROLLEY LABELS TABLE
-- ================================================
-- Tracks printed trolley labels for scan-to-pick workflow

CREATE TABLE IF NOT EXISTS public.trolley_labels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  order_id uuid,
  pick_list_id uuid,

  -- Label identification
  label_code text NOT NULL,  -- Encoded datamatrix content (HT:orgId:orderId:timestamp)
  trolley_number text,       -- Optional specific trolley number
  customer_name text,        -- Cached for label printing
  order_number text,         -- Cached for label printing

  -- Status tracking
  printed_at timestamptz,
  printed_by uuid,
  scanned_at timestamptz,
  scanned_by uuid,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trolley_labels_pkey PRIMARY KEY (id),
  CONSTRAINT trolley_labels_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT trolley_labels_order_id_fkey FOREIGN KEY (order_id)
    REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT trolley_labels_pick_list_id_fkey FOREIGN KEY (pick_list_id)
    REFERENCES public.pick_lists(id) ON DELETE SET NULL,
  CONSTRAINT trolley_labels_printed_by_fkey FOREIGN KEY (printed_by)
    REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT trolley_labels_scanned_by_fkey FOREIGN KEY (scanned_by)
    REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT trolley_labels_unique_code UNIQUE (org_id, label_code)
);

CREATE INDEX idx_trolley_labels_order ON public.trolley_labels(order_id);
CREATE INDEX idx_trolley_labels_code ON public.trolley_labels(org_id, label_code);
CREATE INDEX idx_trolley_labels_pick_list ON public.trolley_labels(pick_list_id)
  WHERE pick_list_id IS NOT NULL;

-- ================================================
-- PICK LISTS - ADD COLUMNS FOR SPLIT PICKING & QC
-- ================================================

-- Add is_partial flag for split picking
ALTER TABLE public.pick_lists
  ADD COLUMN IF NOT EXISTS is_partial boolean NOT NULL DEFAULT false;

-- Add merge_status for tracking split pick completion
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pick_lists' AND column_name = 'merge_status') THEN
    ALTER TABLE public.pick_lists
      ADD COLUMN merge_status text CHECK (merge_status IN ('pending', 'ready', 'merged'));
  END IF;
END $$;

-- Add qc_status for tracking QC outcome
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pick_lists' AND column_name = 'qc_status') THEN
    ALTER TABLE public.pick_lists
      ADD COLUMN qc_status text CHECK (qc_status IN ('pending', 'passed', 'failed'));
  END IF;
END $$;

-- Add parent_pick_list_id for tracking split relationships
ALTER TABLE public.pick_lists
  ADD COLUMN IF NOT EXISTS parent_pick_list_id uuid REFERENCES public.pick_lists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pick_lists_parent ON public.pick_lists(parent_pick_list_id)
  WHERE parent_pick_list_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pick_lists_qc_status ON public.pick_lists(org_id, qc_status)
  WHERE qc_status IS NOT NULL;

-- ================================================
-- HAULIERS - ADD INTERNAL FLAG
-- ================================================

ALTER TABLE public.hauliers
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.hauliers.is_internal IS 'true = own fleet, false = external haulier';

-- ================================================
-- DELIVERY RUNS - ADD COLOR CODE AND LOAD NAME
-- ================================================

ALTER TABLE public.delivery_runs
  ADD COLUMN IF NOT EXISTS color_code text;

ALTER TABLE public.delivery_runs
  ADD COLUMN IF NOT EXISTS load_name text;

ALTER TABLE public.delivery_runs
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.delivery_runs
  ADD COLUMN IF NOT EXISTS week_number integer;

ALTER TABLE public.delivery_runs
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.haulier_vehicles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.delivery_runs.color_code IS 'UI color code for load visualization';
COMMENT ON COLUMN public.delivery_runs.load_name IS 'Custom name for the load (e.g., Cork Load 1)';
COMMENT ON COLUMN public.delivery_runs.display_order IS 'Order for displaying loads in UI';

CREATE INDEX IF NOT EXISTS idx_delivery_runs_vehicle ON public.delivery_runs(vehicle_id)
  WHERE vehicle_id IS NOT NULL;

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE public.qc_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trolley_labels ENABLE ROW LEVEL SECURITY;

-- QC Feedback policies
CREATE POLICY "Users can view QC feedback in their org" ON public.qc_feedback
  FOR SELECT USING (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create QC feedback in their org" ON public.qc_feedback
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update QC feedback in their org" ON public.qc_feedback
  FOR UPDATE USING (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()
    )
  );

-- Trolley Labels policies
CREATE POLICY "Users can view trolley labels in their org" ON public.trolley_labels
  FOR SELECT USING (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create trolley labels in their org" ON public.trolley_labels
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update trolley labels in their org" ON public.trolley_labels
  FOR UPDATE USING (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()
    )
  );

-- ================================================
-- GRANTS
-- ================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trolley_labels TO authenticated;

-- Service role needs full access
GRANT ALL ON public.qc_feedback TO service_role;
GRANT ALL ON public.trolley_labels TO service_role;

-- ================================================
-- VIEW: Picker tasks with feedback count
-- ================================================

CREATE OR REPLACE VIEW v_picker_tasks AS
SELECT
  pl.id,
  pl.org_id,
  pl.order_id,
  pl.assigned_user_id,
  pl.assigned_team_id,
  pl.sequence,
  pl.status,
  pl.qc_status,
  pl.is_partial,
  pl.merge_status,
  pl.started_at,
  pl.completed_at,
  pl.notes,
  pl.created_at,
  o.order_number,
  o.status as order_status,
  o.requested_delivery_date,
  c.name as customer_name,
  -- Item counts
  (SELECT COUNT(*) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as total_items,
  (SELECT COUNT(*) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id AND pi.status IN ('picked', 'substituted')) as picked_items,
  (SELECT SUM(pi.target_qty) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as total_qty,
  (SELECT SUM(pi.picked_qty) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as picked_qty,
  -- QC feedback count
  (SELECT COUNT(*) FROM public.qc_feedback qf WHERE qf.pick_list_id = pl.id AND qf.resolved_at IS NULL) as pending_feedback_count,
  (SELECT COUNT(*) FROM public.qc_feedback qf WHERE qf.pick_list_id = pl.id AND qf.picker_acknowledged_at IS NULL AND qf.picker_notified_at IS NOT NULL) as unacknowledged_feedback_count
FROM public.pick_lists pl
LEFT JOIN public.orders o ON o.id = pl.order_id
LEFT JOIN public.customers c ON c.id = o.customer_id;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE public.qc_feedback IS 'Quality control feedback from manager to picker for failed QC checks';
COMMENT ON TABLE public.trolley_labels IS 'Printed trolley labels with datamatrix codes for scan-to-pick workflow';
COMMENT ON VIEW v_picker_tasks IS 'Picker task list with order details and feedback counts';
