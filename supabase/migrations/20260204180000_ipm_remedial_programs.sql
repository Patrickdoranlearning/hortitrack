-- IPM Remedial Programs Module
-- Dedicated treatment protocols for pest/disease remediation
-- This migration creates tables for remedial programs that are triggered by scout findings

-- ============================================================================
-- 1. IPM Remedial Programs - Protocol definitions indexed by pest/disease
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_remedial_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_pest_disease text NOT NULL,                  -- What this treats (e.g., "Powdery Mildew", "Aphids")
  severity_applicability text[] DEFAULT ARRAY['medium', 'critical'],  -- Which severities this applies to
  treatment_duration_days int NOT NULL DEFAULT 14,    -- Expected total duration
  treatment_urgency text NOT NULL DEFAULT 'standard'  -- 'immediate' | 'standard'
    CHECK (treatment_urgency IN ('immediate', 'standard')),
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for ipm_remedial_programs
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_programs_org
  ON public.ipm_remedial_programs(org_id);
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_programs_pest
  ON public.ipm_remedial_programs(org_id, target_pest_disease);
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_programs_active
  ON public.ipm_remedial_programs(org_id, is_active) WHERE is_active = true;

-- RLS for ipm_remedial_programs
ALTER TABLE public.ipm_remedial_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org ipm_remedial_programs" ON public.ipm_remedial_programs;
CREATE POLICY "Users can view org ipm_remedial_programs"
ON public.ipm_remedial_programs FOR SELECT
USING (org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage org ipm_remedial_programs" ON public.ipm_remedial_programs;
CREATE POLICY "Users can manage org ipm_remedial_programs"
ON public.ipm_remedial_programs FOR ALL
USING (org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()));

-- ============================================================================
-- 2. IPM Remedial Steps - Treatment steps with day offsets
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_remedial_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.ipm_remedial_programs(id) ON DELETE CASCADE,
  step_order int NOT NULL DEFAULT 1,                  -- Order of this step
  day_offset int NOT NULL DEFAULT 0,                  -- Days from treatment start (0, 7, 14, etc.)
  product_id uuid NOT NULL REFERENCES public.ipm_products(id) ON DELETE RESTRICT,
  rate numeric,                                       -- Application rate
  rate_unit text DEFAULT 'ml/L',                      -- Rate unit
  method text DEFAULT 'Foliar Spray',                 -- Application method
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for ipm_remedial_steps
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_steps_program
  ON public.ipm_remedial_steps(program_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ipm_remedial_steps_order
  ON public.ipm_remedial_steps(program_id, step_order);

-- RLS for ipm_remedial_steps (inherits from program)
ALTER TABLE public.ipm_remedial_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view remedial steps" ON public.ipm_remedial_steps;
CREATE POLICY "Users can view remedial steps"
ON public.ipm_remedial_steps FOR SELECT
USING (program_id IN (
  SELECT rp.id FROM public.ipm_remedial_programs rp
  WHERE rp.org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid())
));

DROP POLICY IF EXISTS "Users can manage remedial steps" ON public.ipm_remedial_steps;
CREATE POLICY "Users can manage remedial steps"
ON public.ipm_remedial_steps FOR ALL
USING (program_id IN (
  SELECT rp.id FROM public.ipm_remedial_programs rp
  WHERE rp.org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid())
))
WITH CHECK (program_id IN (
  SELECT rp.id FROM public.ipm_remedial_programs rp
  WHERE rp.org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid())
));

-- ============================================================================
-- 3. IPM Remedial Applications - Applied treatments tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_remedial_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.ipm_remedial_programs(id) ON DELETE RESTRICT,
  triggered_by_log_id uuid REFERENCES public.plant_health_logs(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('batch', 'location')),
  target_batch_id uuid REFERENCES public.batches(id) ON DELETE CASCADE,
  target_location_id uuid REFERENCES public.nursery_locations(id) ON DELETE CASCADE,
  started_at date NOT NULL DEFAULT CURRENT_DATE,
  expected_completion date,                           -- Calculated from duration
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  steps_completed int NOT NULL DEFAULT 0,
  total_steps int NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Constraint to ensure proper target based on type
  CONSTRAINT ipm_remedial_applications_target_check CHECK (
    (target_type = 'batch' AND target_batch_id IS NOT NULL) OR
    (target_type = 'location' AND target_location_id IS NOT NULL)
  )
);

-- Indexes for ipm_remedial_applications
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_applications_org
  ON public.ipm_remedial_applications(org_id);
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_applications_program
  ON public.ipm_remedial_applications(program_id);
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_applications_status
  ON public.ipm_remedial_applications(org_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_applications_batch
  ON public.ipm_remedial_applications(target_batch_id) WHERE target_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_applications_location
  ON public.ipm_remedial_applications(target_location_id) WHERE target_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_applications_log
  ON public.ipm_remedial_applications(triggered_by_log_id) WHERE triggered_by_log_id IS NOT NULL;

-- RLS for ipm_remedial_applications
ALTER TABLE public.ipm_remedial_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org ipm_remedial_applications" ON public.ipm_remedial_applications;
CREATE POLICY "Users can view org ipm_remedial_applications"
ON public.ipm_remedial_applications FOR SELECT
USING (org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage org ipm_remedial_applications" ON public.ipm_remedial_applications;
CREATE POLICY "Users can manage org ipm_remedial_applications"
ON public.ipm_remedial_applications FOR ALL
USING (org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()));

-- ============================================================================
-- 4. IPM Remedial Application Steps - Track individual step completions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_remedial_application_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.ipm_remedial_applications(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.ipm_remedial_steps(id) ON DELETE RESTRICT,
  due_date date NOT NULL,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  plant_health_log_id uuid REFERENCES public.plant_health_logs(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for ipm_remedial_application_steps
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_application_steps_app
  ON public.ipm_remedial_application_steps(application_id);
CREATE INDEX IF NOT EXISTS idx_ipm_remedial_application_steps_due
  ON public.ipm_remedial_application_steps(due_date) WHERE completed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ipm_remedial_application_steps_unique
  ON public.ipm_remedial_application_steps(application_id, step_id);

-- RLS for ipm_remedial_application_steps (inherits from application)
ALTER TABLE public.ipm_remedial_application_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view remedial application steps" ON public.ipm_remedial_application_steps;
CREATE POLICY "Users can view remedial application steps"
ON public.ipm_remedial_application_steps FOR SELECT
USING (application_id IN (
  SELECT ra.id FROM public.ipm_remedial_applications ra
  WHERE ra.org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid())
));

DROP POLICY IF EXISTS "Users can manage remedial application steps" ON public.ipm_remedial_application_steps;
CREATE POLICY "Users can manage remedial application steps"
ON public.ipm_remedial_application_steps FOR ALL
USING (application_id IN (
  SELECT ra.id FROM public.ipm_remedial_applications ra
  WHERE ra.org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid())
))
WITH CHECK (application_id IN (
  SELECT ra.id FROM public.ipm_remedial_applications ra
  WHERE ra.org_id IN (SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid())
));

-- ============================================================================
-- 5. View: Remedial programs by pest with product info
-- ============================================================================
CREATE OR REPLACE VIEW public.v_remedial_programs_by_pest
WITH (security_invoker = true)
AS
SELECT
  rp.id,
  rp.org_id,
  rp.name,
  rp.description,
  rp.target_pest_disease,
  rp.severity_applicability,
  rp.treatment_duration_days,
  rp.treatment_urgency,
  rp.is_active,
  rp.created_at,
  (
    SELECT COUNT(*) FROM public.ipm_remedial_steps rs WHERE rs.program_id = rp.id
  ) as step_count,
  (
    SELECT array_agg(DISTINCT p.name ORDER BY p.name)
    FROM public.ipm_remedial_steps rs
    JOIN public.ipm_products p ON rs.product_id = p.id
    WHERE rs.program_id = rp.id
  ) as product_names,
  (
    SELECT array_agg(DISTINCT p.id)
    FROM public.ipm_remedial_steps rs
    JOIN public.ipm_products p ON rs.product_id = p.id
    WHERE rs.program_id = rp.id
  ) as product_ids
FROM public.ipm_remedial_programs rp
WHERE rp.is_active = true
ORDER BY rp.target_pest_disease, rp.name;

-- ============================================================================
-- 6. Trigger to update steps_completed and status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_remedial_application_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_completed_count int;
  v_total_steps int;
BEGIN
  -- Count completed steps for this application
  SELECT COUNT(*) INTO v_completed_count
  FROM public.ipm_remedial_application_steps
  WHERE application_id = NEW.application_id
    AND completed_at IS NOT NULL;

  -- Get total steps
  SELECT total_steps INTO v_total_steps
  FROM public.ipm_remedial_applications
  WHERE id = NEW.application_id;

  -- Update the application
  UPDATE public.ipm_remedial_applications
  SET
    steps_completed = v_completed_count,
    status = CASE
      WHEN v_completed_count >= v_total_steps THEN 'completed'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.application_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS trg_remedial_step_completion ON public.ipm_remedial_application_steps;
CREATE TRIGGER trg_remedial_step_completion
AFTER UPDATE OF completed_at ON public.ipm_remedial_application_steps
FOR EACH ROW
WHEN (OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL)
EXECUTE FUNCTION public.update_remedial_application_progress();

-- ============================================================================
-- 7. Add link from plant_health_logs to remedial applications
-- ============================================================================
ALTER TABLE public.plant_health_logs
  ADD COLUMN IF NOT EXISTS remedial_application_id uuid REFERENCES public.ipm_remedial_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_plant_health_logs_remedial_app
  ON public.plant_health_logs(remedial_application_id)
  WHERE remedial_application_id IS NOT NULL;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE public.ipm_remedial_programs IS 'Remedial treatment protocols indexed by pest/disease for quick lookup during scouting';
COMMENT ON TABLE public.ipm_remedial_steps IS 'Individual treatment steps within a remedial program with day offsets';
COMMENT ON TABLE public.ipm_remedial_applications IS 'Applied remedial treatments tracking with progress';
COMMENT ON TABLE public.ipm_remedial_application_steps IS 'Individual step tracking for applied remedial treatments';
COMMENT ON VIEW public.v_remedial_programs_by_pest IS 'Aggregated view of remedial programs with product info, grouped by pest';
