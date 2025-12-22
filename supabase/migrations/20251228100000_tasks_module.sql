-- Tasks Module: Generic tasks system with production jobs and productivity tracking

-- =============================================================================
-- TASKS TABLE (Generic task container for all modules)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Source module reference (polymorphic link)
  source_module TEXT NOT NULL,           -- 'production', 'dispatch', 'plant_health'
  source_ref_type TEXT,                  -- 'job', 'pick_list', 'health_check'
  source_ref_id UUID,                    -- ID in source table
  
  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT,                        -- 'potting', 'propagation', 'picking', 'packing', etc.
  
  -- Assignment
  assigned_to UUID REFERENCES public.profiles(id),
  scheduled_date DATE,
  priority INT DEFAULT 0,
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Quantity for productivity tracking
  plant_quantity INT,
  
  -- Automatic time tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  completed_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add check constraint for status values
DO $$
BEGIN
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN
  NULL; -- constraint already exists
END $$;

-- Add check constraint for source_module values
DO $$
BEGIN
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_source_module_check
    CHECK (source_module IN ('production', 'dispatch', 'plant_health'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS tasks_org_id_idx ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS tasks_scheduled_date_idx ON public.tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks(status);
CREATE INDEX IF NOT EXISTS tasks_source_module_idx ON public.tasks(source_module);
CREATE INDEX IF NOT EXISTS tasks_source_ref_idx ON public.tasks(source_ref_type, source_ref_id);

-- Composite index for employee schedule queries
CREATE INDEX IF NOT EXISTS tasks_employee_schedule_idx 
  ON public.tasks(org_id, assigned_to, scheduled_date, status);

-- =============================================================================
-- PRODUCTION JOBS TABLE (Groups ghost batches into assignable work)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.production_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Job details
  name TEXT NOT NULL,
  description TEXT,
  
  -- Grouping metadata
  machine TEXT,                          -- Potting machine name
  location TEXT,                         -- Tunnel/area
  process_type TEXT,                     -- 'potting', 'propagation', 'transplant'
  
  -- Scheduling
  scheduled_week INT,
  scheduled_year INT,
  scheduled_date DATE,
  
  -- Assignment (job-level assignment creates a task)
  assigned_to UUID REFERENCES public.profiles(id),
  task_id UUID REFERENCES public.tasks(id),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- Wizard definition and progress
  wizard_template TEXT,                  -- 'potting', 'propagation' (defines steps)
  wizard_progress JSONB DEFAULT '{}',
  
  -- Completion tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add check constraint for status values
DO $$
BEGIN
  ALTER TABLE public.production_jobs
    ADD CONSTRAINT production_jobs_status_check
    CHECK (status IN ('draft', 'unassigned', 'assigned', 'in_progress', 'completed', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add check constraint for process_type values
DO $$
BEGIN
  ALTER TABLE public.production_jobs
    ADD CONSTRAINT production_jobs_process_type_check
    CHECK (process_type IS NULL OR process_type IN ('potting', 'propagation', 'transplant', 'spacing', 'other'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS production_jobs_org_id_idx ON public.production_jobs(org_id);
CREATE INDEX IF NOT EXISTS production_jobs_status_idx ON public.production_jobs(status);
CREATE INDEX IF NOT EXISTS production_jobs_assigned_to_idx ON public.production_jobs(assigned_to);
CREATE INDEX IF NOT EXISTS production_jobs_scheduled_idx ON public.production_jobs(scheduled_year, scheduled_week);
CREATE INDEX IF NOT EXISTS production_jobs_task_id_idx ON public.production_jobs(task_id);

-- =============================================================================
-- PRODUCTION JOB BATCHES (Junction table linking jobs to ghost batches)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.production_job_batches (
  job_id UUID NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, batch_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS production_job_batches_job_id_idx ON public.production_job_batches(job_id);
CREATE INDEX IF NOT EXISTS production_job_batches_batch_id_idx ON public.production_job_batches(batch_id);

-- =============================================================================
-- PRODUCTIVITY LOGS (Track plants per hour metrics)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.productivity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  task_id UUID REFERENCES public.tasks(id),
  job_id UUID REFERENCES public.production_jobs(id),
  
  -- Metrics
  task_type TEXT NOT NULL,
  plant_count INT NOT NULL,
  duration_minutes INT NOT NULL,
  
  -- Context
  machine TEXT,
  location TEXT,
  
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS productivity_logs_org_id_idx ON public.productivity_logs(org_id);
CREATE INDEX IF NOT EXISTS productivity_logs_user_id_idx ON public.productivity_logs(user_id);
CREATE INDEX IF NOT EXISTS productivity_logs_task_id_idx ON public.productivity_logs(task_id);
CREATE INDEX IF NOT EXISTS productivity_logs_job_id_idx ON public.productivity_logs(job_id);
CREATE INDEX IF NOT EXISTS productivity_logs_logged_at_idx ON public.productivity_logs(logged_at);
CREATE INDEX IF NOT EXISTS productivity_logs_task_type_idx ON public.productivity_logs(task_type);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_job_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productivity_logs ENABLE ROW LEVEL SECURITY;

-- Tasks policies
DROP POLICY IF EXISTS "Users can view org tasks" ON public.tasks;
CREATE POLICY "Users can view org tasks" ON public.tasks
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage org tasks" ON public.tasks;
CREATE POLICY "Users can manage org tasks" ON public.tasks
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  );

-- Production jobs policies
DROP POLICY IF EXISTS "Users can view org production jobs" ON public.production_jobs;
CREATE POLICY "Users can view org production jobs" ON public.production_jobs
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage org production jobs" ON public.production_jobs;
CREATE POLICY "Users can manage org production jobs" ON public.production_jobs
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  );

-- Production job batches policies (via job org_id)
DROP POLICY IF EXISTS "Users can view org job batches" ON public.production_job_batches;
CREATE POLICY "Users can view org job batches" ON public.production_job_batches
  FOR SELECT USING (
    job_id IN (
      SELECT id FROM public.production_jobs 
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can manage org job batches" ON public.production_job_batches;
CREATE POLICY "Users can manage org job batches" ON public.production_job_batches
  FOR ALL USING (
    job_id IN (
      SELECT id FROM public.production_jobs 
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT id FROM public.production_jobs 
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    )
  );

-- Productivity logs policies
DROP POLICY IF EXISTS "Users can view org productivity logs" ON public.productivity_logs;
CREATE POLICY "Users can view org productivity logs" ON public.productivity_logs
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert org productivity logs" ON public.productivity_logs;
CREATE POLICY "Users can insert org productivity logs" ON public.productivity_logs
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  );

-- =============================================================================
-- SERVICE ROLE ACCESS
-- =============================================================================

GRANT ALL ON public.tasks TO service_role;
GRANT ALL ON public.production_jobs TO service_role;
GRANT ALL ON public.production_job_batches TO service_role;
GRANT ALL ON public.productivity_logs TO service_role;

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS production_jobs_updated_at ON public.production_jobs;
CREATE TRIGGER production_jobs_updated_at
  BEFORE UPDATE ON public.production_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- HELPER VIEW: Tasks with computed duration and plants per hour
-- =============================================================================

CREATE OR REPLACE VIEW public.tasks_with_productivity AS
SELECT 
  t.*,
  CASE 
    WHEN t.completed_at IS NOT NULL AND t.started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) / 60 
    ELSE NULL 
  END AS duration_minutes,
  CASE 
    WHEN t.completed_at IS NOT NULL 
      AND t.started_at IS NOT NULL 
      AND t.plant_quantity IS NOT NULL 
      AND EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) > 0
    THEN (t.plant_quantity::NUMERIC / (EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) / 60)) * 60
    ELSE NULL 
  END AS plants_per_hour,
  p.display_name AS assigned_to_name,
  p.email AS assigned_to_email
FROM public.tasks t
LEFT JOIN public.profiles p ON t.assigned_to = p.id;

-- Grant access to the view
GRANT SELECT ON public.tasks_with_productivity TO authenticated;
GRANT SELECT ON public.tasks_with_productivity TO service_role;

-- =============================================================================
-- HELPER VIEW: Production jobs with batch counts and totals
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

-- Grant access to the view
GRANT SELECT ON public.production_jobs_summary TO authenticated;
GRANT SELECT ON public.production_jobs_summary TO service_role;


