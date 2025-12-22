-- ================================================
-- ORDER QC CHECKS
-- ================================================
-- QC review stage for dispatch - managers verify picked orders before dispatch

-- Add QC status values to pick_list_status enum
ALTER TYPE pick_list_status ADD VALUE IF NOT EXISTS 'qc_pending' AFTER 'completed';
ALTER TYPE pick_list_status ADD VALUE IF NOT EXISTS 'qc_passed' AFTER 'qc_pending';
ALTER TYPE pick_list_status ADD VALUE IF NOT EXISTS 'qc_failed' AFTER 'qc_passed';

-- Create QC check status type
DO $$ BEGIN
  CREATE TYPE qc_check_status AS ENUM ('pending', 'passed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Order QC checks table
CREATE TABLE IF NOT EXISTS public.order_qc_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  pick_list_id uuid REFERENCES public.pick_lists(id) ON DELETE SET NULL,
  
  -- Checklist items (all must pass for approval)
  qty_correct boolean,
  variety_correct boolean,
  quality_acceptable boolean,
  size_correct boolean,
  labelling_ok boolean,
  
  -- Status
  status qc_check_status NOT NULL DEFAULT 'pending',
  
  -- If failed
  failure_reason text,
  failed_items jsonb DEFAULT '[]'::jsonb, -- Array of {itemId, issue, notes}
  
  -- Audit
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT order_qc_checks_org_id_fkey FOREIGN KEY (org_id) 
    REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_qc_checks_org ON public.order_qc_checks(org_id);
CREATE INDEX IF NOT EXISTS idx_order_qc_checks_order ON public.order_qc_checks(order_id);
CREATE INDEX IF NOT EXISTS idx_order_qc_checks_pick_list ON public.order_qc_checks(pick_list_id);
CREATE INDEX IF NOT EXISTS idx_order_qc_checks_status ON public.order_qc_checks(org_id, status);

-- Enable RLS
ALTER TABLE public.order_qc_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view QC checks for their org" ON public.order_qc_checks
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert QC checks for their org" ON public.order_qc_checks
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_memberships 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update QC checks for their org" ON public.order_qc_checks
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships 
      WHERE user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE public.order_qc_checks IS 'QC verification records for picked orders before dispatch';
COMMENT ON COLUMN public.order_qc_checks.qty_correct IS 'Quantity matches order';
COMMENT ON COLUMN public.order_qc_checks.variety_correct IS 'Correct plant variety/product';
COMMENT ON COLUMN public.order_qc_checks.quality_acceptable IS 'Plant quality is acceptable (no damage, pests, disease)';
COMMENT ON COLUMN public.order_qc_checks.size_correct IS 'Correct pot size';
COMMENT ON COLUMN public.order_qc_checks.labelling_ok IS 'Plants are properly labelled';
COMMENT ON COLUMN public.order_qc_checks.failed_items IS 'JSON array of failed items: [{itemId, issue, notes}]';




