-- =============================================================================
-- Migration: Execution Worksheets
-- Description: Add persistent worksheet tracking for batch execution
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: execution_worksheets
-- Stores saved worksheets created from batch selections on the execution page
-- -----------------------------------------------------------------------------

CREATE TABLE public.execution_worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Worksheet details
  name TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open',  -- 'open', 'completed'

  -- Completion metadata
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status check constraint
ALTER TABLE public.execution_worksheets
  ADD CONSTRAINT execution_worksheets_status_check
  CHECK (status IN ('open', 'completed'));

-- Indexes
CREATE INDEX execution_worksheets_org_id_idx ON public.execution_worksheets(org_id);
CREATE INDEX execution_worksheets_status_idx ON public.execution_worksheets(status);
CREATE INDEX execution_worksheets_scheduled_date_idx ON public.execution_worksheets(scheduled_date);

-- Updated_at trigger
CREATE TRIGGER set_execution_worksheets_updated_at
  BEFORE UPDATE ON public.execution_worksheets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Table: execution_worksheet_batches
-- Junction table linking worksheets to batches with per-batch tracking
-- -----------------------------------------------------------------------------

CREATE TABLE public.execution_worksheet_batches (
  worksheet_id UUID NOT NULL REFERENCES public.execution_worksheets(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,

  -- Ordering
  sort_order INT DEFAULT 0,

  -- Per-batch completion tracking (denormalized for performance)
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),

  -- Notes specific to this batch in this worksheet
  notes TEXT,

  -- Audit
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (worksheet_id, batch_id)
);

-- Indexes
CREATE INDEX execution_worksheet_batches_worksheet_id_idx
  ON public.execution_worksheet_batches(worksheet_id);
CREATE INDEX execution_worksheet_batches_batch_id_idx
  ON public.execution_worksheet_batches(batch_id);

-- -----------------------------------------------------------------------------
-- RLS Policies: execution_worksheets
-- Using org_memberships pattern for tenant isolation
-- -----------------------------------------------------------------------------

ALTER TABLE public.execution_worksheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view worksheets in their org"
  ON public.execution_worksheets
  FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can create worksheets in their org"
  ON public.execution_worksheets
  FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can update worksheets in their org"
  ON public.execution_worksheets
  FOR UPDATE
  USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can delete worksheets in their org"
  ON public.execution_worksheets
  FOR DELETE
  USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- RLS Policies: execution_worksheet_batches
-- Inherits access through parent worksheet
-- -----------------------------------------------------------------------------

ALTER TABLE public.execution_worksheet_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view worksheet batches in their org"
  ON public.execution_worksheet_batches
  FOR SELECT
  USING (
    worksheet_id IN (
      SELECT id FROM public.execution_worksheets
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can create worksheet batches in their org"
  ON public.execution_worksheet_batches
  FOR INSERT
  WITH CHECK (
    worksheet_id IN (
      SELECT id FROM public.execution_worksheets
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can update worksheet batches in their org"
  ON public.execution_worksheet_batches
  FOR UPDATE
  USING (
    worksheet_id IN (
      SELECT id FROM public.execution_worksheets
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can delete worksheet batches in their org"
  ON public.execution_worksheet_batches
  FOR DELETE
  USING (
    worksheet_id IN (
      SELECT id FROM public.execution_worksheets
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- Trigger: Auto-complete worksheet batches when batches are actualized
-- When a batch transitions from ghost status (Incoming/Planned) to active,
-- mark any worksheet entries for that batch as completed
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_mark_worksheet_batch_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a batch is actualized (status changes from Incoming/Planned to something else)
  IF OLD.status IN ('Incoming', 'Planned') AND NEW.status NOT IN ('Incoming', 'Planned') THEN
    -- Mark any worksheet entries for this batch as completed
    UPDATE public.execution_worksheet_batches
    SET completed_at = now(),
        completed_by = (SELECT nullif(current_setting('app.current_user_id', true), '')::uuid)
    WHERE batch_id = NEW.id
      AND completed_at IS NULL;

    -- Check if any worksheets are now fully complete
    UPDATE public.execution_worksheets w
    SET status = 'completed',
        completed_at = now(),
        completed_by = (SELECT nullif(current_setting('app.current_user_id', true), '')::uuid),
        updated_at = now()
    WHERE w.id IN (
      SELECT DISTINCT worksheet_id
      FROM public.execution_worksheet_batches
      WHERE batch_id = NEW.id
    )
    AND w.status = 'open'
    AND NOT EXISTS (
      SELECT 1 FROM public.execution_worksheet_batches wb
      WHERE wb.worksheet_id = w.id
        AND wb.completed_at IS NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_worksheet_batch_completed
  AFTER UPDATE OF status ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_mark_worksheet_batch_completed();

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.execution_worksheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execution_worksheet_batches TO authenticated;

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.execution_worksheets IS 'Saved worksheets created from batch selections on the execution page';
COMMENT ON TABLE public.execution_worksheet_batches IS 'Junction table linking worksheets to batches with per-batch completion tracking';
COMMENT ON COLUMN public.execution_worksheets.status IS 'Worksheet status: open (in progress) or completed (all batches actualized)';
COMMENT ON COLUMN public.execution_worksheet_batches.completed_at IS 'When the batch was actualized (set automatically by trigger)';
COMMENT ON FUNCTION public.fn_mark_worksheet_batch_completed() IS 'Auto-completes worksheet batch entries when batches are actualized';
