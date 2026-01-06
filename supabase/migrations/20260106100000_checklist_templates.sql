-- Checklist Templates Module: Admin-configurable pre/post-flight checklists for tasks and jobs

-- =============================================================================
-- CHECKLIST TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Template identification
  name TEXT NOT NULL,                    -- "Potting Prep", "Post-Spray Safety"
  description TEXT,
  
  -- Classification
  process_type TEXT NOT NULL,            -- 'potting', 'propagation', 'spraying', 'picking', 'packing', 'loading'
  checklist_type TEXT NOT NULL,          -- 'prerequisite' or 'postrequisite'
  source_module TEXT NOT NULL DEFAULT 'production', -- 'production', 'plant_health', 'dispatch'
  
  -- Checklist items: [{id: uuid, label: string, required: boolean, order: number}]
  items JSONB NOT NULL DEFAULT '[]',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add check constraint for checklist_type values
DO $$
BEGIN
  ALTER TABLE public.checklist_templates
    ADD CONSTRAINT checklist_templates_type_check
    CHECK (checklist_type IN ('prerequisite', 'postrequisite'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add check constraint for source_module values
DO $$
BEGIN
  ALTER TABLE public.checklist_templates
    ADD CONSTRAINT checklist_templates_module_check
    CHECK (source_module IN ('production', 'plant_health', 'dispatch'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS checklist_templates_org_id_idx ON public.checklist_templates(org_id);
CREATE INDEX IF NOT EXISTS checklist_templates_process_type_idx ON public.checklist_templates(process_type);
CREATE INDEX IF NOT EXISTS checklist_templates_source_module_idx ON public.checklist_templates(source_module);
CREATE INDEX IF NOT EXISTS checklist_templates_active_idx ON public.checklist_templates(org_id, is_active) WHERE is_active = true;

-- Composite index for common lookup
CREATE INDEX IF NOT EXISTS checklist_templates_lookup_idx 
  ON public.checklist_templates(org_id, source_module, process_type, checklist_type, is_active);

-- =============================================================================
-- ADD CHECKLIST PROGRESS TO TASKS AND PRODUCTION_JOBS
-- =============================================================================

-- Add checklist_progress to tasks table
-- Structure: { 
--   prerequisites: [{itemId: uuid, checked: boolean, skippedReason?: string, timestamp?: string}],
--   postrequisites: [{itemId: uuid, checked: boolean, skippedReason?: string, timestamp?: string}]
-- }
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS checklist_progress JSONB DEFAULT '{}';

-- Add checklist_progress to production_jobs table
ALTER TABLE public.production_jobs 
  ADD COLUMN IF NOT EXISTS checklist_progress JSONB DEFAULT '{}';

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

-- View policy
DROP POLICY IF EXISTS "Users can view org checklist templates" ON public.checklist_templates;
CREATE POLICY "Users can view org checklist templates" ON public.checklist_templates
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  );

-- Manage policy (admins and owners only)
DROP POLICY IF EXISTS "Admins can manage org checklist templates" ON public.checklist_templates;
CREATE POLICY "Admins can manage org checklist templates" ON public.checklist_templates
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- SERVICE ROLE ACCESS
-- =============================================================================

GRANT ALL ON public.checklist_templates TO service_role;

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

DROP TRIGGER IF EXISTS checklist_templates_updated_at ON public.checklist_templates;
CREATE TRIGGER checklist_templates_updated_at
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- HELPER VIEW: Templates with item counts
-- =============================================================================

CREATE OR REPLACE VIEW public.checklist_templates_summary AS
SELECT 
  ct.*,
  jsonb_array_length(ct.items) AS item_count,
  p.display_name AS created_by_name
FROM public.checklist_templates ct
LEFT JOIN public.profiles p ON ct.created_by = p.id;

GRANT SELECT ON public.checklist_templates_summary TO authenticated;
GRANT SELECT ON public.checklist_templates_summary TO service_role;

-- =============================================================================
-- UPDATE PRODUCTION_JOBS_SUMMARY VIEW TO INCLUDE CHECKLIST_PROGRESS
-- =============================================================================

CREATE OR REPLACE VIEW public.production_jobs_summary AS
SELECT 
  j.*,
  COALESCE(batch_stats.batch_count, 0) AS batch_count,
  COALESCE(batch_stats.total_plants, 0) AS total_plants,
  p.display_name AS assigned_to_name,
  p.email AS assigned_to_email,
  CASE 
    WHEN j.completed_at IS NOT NULL AND j.started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (j.completed_at - j.started_at)) / 60 
    ELSE NULL 
  END AS duration_minutes
FROM public.production_jobs j
LEFT JOIN public.profiles p ON j.assigned_to = p.id
LEFT JOIN (
  SELECT 
    pjb.job_id,
    COUNT(*)::INT AS batch_count,
    SUM(b.quantity)::INT AS total_plants
  FROM public.production_job_batches pjb
  JOIN public.batches b ON pjb.batch_id = b.id
  GROUP BY pjb.job_id
) batch_stats ON j.id = batch_stats.job_id;

