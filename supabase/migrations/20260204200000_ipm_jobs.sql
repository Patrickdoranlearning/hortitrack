-- IPM Jobs table for applicator assignment and tracking
-- Jobs group related tasks for a single spray run

-- ============================================================================
-- 1. Create ipm_jobs table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  group_key TEXT NOT NULL,

  -- Scheduling
  scheduled_date DATE NOT NULL,
  calendar_week INTEGER NOT NULL,

  -- Status lifecycle: pending -> assigned -> in_progress -> completed
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),

  -- Assignment
  assigned_to UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES public.profiles(id),
  scout_notes TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Execution tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),

  -- Compliance data (job-level, not per-task)
  weather_conditions TEXT,
  sprayer_used TEXT,
  total_volume_ml INTEGER,
  bottle_id UUID REFERENCES public.ipm_product_bottles(id),
  quantity_used_ml INTEGER,
  signed_by TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One job per group per week per org
  UNIQUE(org_id, group_key, calendar_week)
);

-- Indexes
CREATE INDEX idx_ipm_jobs_org ON public.ipm_jobs(org_id);
CREATE INDEX idx_ipm_jobs_status ON public.ipm_jobs(org_id, status);
CREATE INDEX idx_ipm_jobs_assigned ON public.ipm_jobs(assigned_to) WHERE status IN ('assigned', 'in_progress');
CREATE INDEX idx_ipm_jobs_week ON public.ipm_jobs(org_id, calendar_week);
CREATE INDEX idx_ipm_jobs_group_key ON public.ipm_jobs(org_id, group_key);
CREATE INDEX idx_ipm_jobs_scheduled ON public.ipm_jobs(org_id, scheduled_date);

-- RLS
ALTER TABLE public.ipm_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org ipm_jobs"
ON public.ipm_jobs FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org ipm_jobs"
ON public.ipm_jobs FOR ALL
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

COMMENT ON TABLE public.ipm_jobs IS 'Application jobs that group IPM tasks for a single spray run';
COMMENT ON COLUMN public.ipm_jobs.group_key IS 'Links to tasks via computed group_key (product:id-rate:x-method:y or tankmix:groupId)';
COMMENT ON COLUMN public.ipm_jobs.scout_notes IS 'Notes from scout to applicator about this job';

-- ============================================================================
-- 2. Add job_id and group_key columns to ipm_tasks
-- ============================================================================
ALTER TABLE public.ipm_tasks
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.ipm_jobs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS group_key TEXT;

-- Index for job lookup
CREATE INDEX IF NOT EXISTS idx_ipm_tasks_job ON public.ipm_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_ipm_tasks_group_key ON public.ipm_tasks(org_id, group_key, calendar_week);

-- ============================================================================
-- 3. Trigger to compute group_key on ipm_tasks insert/update
-- ============================================================================
CREATE OR REPLACE FUNCTION compute_ipm_task_group_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tank_mix_group_id IS NOT NULL THEN
    NEW.group_key := 'tankmix:' || NEW.tank_mix_group_id;
  ELSE
    NEW.group_key := 'product:' || NEW.product_id ||
                     '-rate:' || COALESCE(NEW.rate::text, 'default') ||
                     '-method:' || COALESCE(NEW.method, 'spray');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ipm_task_group_key ON public.ipm_tasks;
CREATE TRIGGER trg_ipm_task_group_key
BEFORE INSERT OR UPDATE OF product_id, rate, method, tank_mix_group_id ON public.ipm_tasks
FOR EACH ROW EXECUTE FUNCTION compute_ipm_task_group_key();

-- ============================================================================
-- 4. Backfill existing tasks with group_key
-- ============================================================================
UPDATE public.ipm_tasks
SET group_key = CASE
  WHEN tank_mix_group_id IS NOT NULL THEN 'tankmix:' || tank_mix_group_id
  ELSE 'product:' || product_id || '-rate:' || COALESCE(rate::text, 'default') || '-method:' || COALESCE(method, 'spray')
END
WHERE group_key IS NULL;

-- ============================================================================
-- 5. Auto-update job status trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_ipm_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ipm_jobs_updated_at ON public.ipm_jobs;
CREATE TRIGGER trg_ipm_jobs_updated_at
BEFORE UPDATE ON public.ipm_jobs
FOR EACH ROW EXECUTE FUNCTION update_ipm_job_updated_at();
