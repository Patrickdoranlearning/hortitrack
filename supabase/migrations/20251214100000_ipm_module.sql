-- IPM (Integrated Pest Management) Module Extension for Plant Health
-- This migration creates the core IPM infrastructure

-- ============================================================================
-- 1. IPM Products Table - Master database of all IPM products
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  pcs_number text,                              -- Regulatory registration number
  active_ingredient text,                       -- Primary active ingredient
  target_pests text[] DEFAULT '{}',             -- Array of pest/disease names
  suggested_rate numeric,                       -- Suggested application rate
  suggested_rate_unit text DEFAULT 'ml/L',      -- 'ml/L', 'g/L', 'kg/ha', etc.
  max_rate numeric,                             -- Maximum allowed rate
  harvest_interval_days int,                    -- Withholding period before harvest
  rei_hours int DEFAULT 0,                      -- Re-entry interval in hours
  use_restriction text DEFAULT 'both' 
    CHECK (use_restriction IN ('indoor', 'outdoor', 'both')),
  application_methods text[] DEFAULT ARRAY['Foliar Spray'],
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for ipm_products
CREATE INDEX IF NOT EXISTS idx_ipm_products_org_id ON public.ipm_products(org_id);
CREATE INDEX IF NOT EXISTS idx_ipm_products_active ON public.ipm_products(org_id, is_active);

-- RLS for ipm_products
ALTER TABLE public.ipm_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org ipm_products" ON public.ipm_products;
CREATE POLICY "Users can view org ipm_products"
ON public.ipm_products FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage org ipm_products" ON public.ipm_products;
CREATE POLICY "Users can manage org ipm_products"
ON public.ipm_products FOR ALL
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- ============================================================================
-- 2. IPM Programs Table - Reusable interval-based treatment programs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  interval_days int NOT NULL,                   -- Apply every X days
  duration_weeks int NOT NULL,                  -- For Y weeks total
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for ipm_programs
CREATE INDEX IF NOT EXISTS idx_ipm_programs_org_id ON public.ipm_programs(org_id);
CREATE INDEX IF NOT EXISTS idx_ipm_programs_active ON public.ipm_programs(org_id, is_active);

-- RLS for ipm_programs
ALTER TABLE public.ipm_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org ipm_programs" ON public.ipm_programs;
CREATE POLICY "Users can view org ipm_programs"
ON public.ipm_programs FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage org ipm_programs" ON public.ipm_programs;
CREATE POLICY "Users can manage org ipm_programs"
ON public.ipm_programs FOR ALL
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- ============================================================================
-- 3. IPM Program Steps - Products/steps within a program
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_program_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.ipm_programs(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.ipm_products(id) ON DELETE RESTRICT,
  step_order int NOT NULL DEFAULT 1,            -- Order of application in rotation
  rate numeric,                                 -- Override rate for this step
  rate_unit text,                               -- Override unit for this step
  method text,                                  -- Application method for this step
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for ipm_program_steps
CREATE INDEX IF NOT EXISTS idx_ipm_program_steps_program ON public.ipm_program_steps(program_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ipm_program_steps_order ON public.ipm_program_steps(program_id, step_order);

-- RLS for ipm_program_steps (inherits from program)
ALTER TABLE public.ipm_program_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view program steps" ON public.ipm_program_steps;
CREATE POLICY "Users can view program steps"
ON public.ipm_program_steps FOR SELECT
USING (program_id IN (
  SELECT id FROM public.ipm_programs 
  WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
));

DROP POLICY IF EXISTS "Users can manage program steps" ON public.ipm_program_steps;
CREATE POLICY "Users can manage program steps"
ON public.ipm_program_steps FOR ALL
USING (program_id IN (
  SELECT id FROM public.ipm_programs 
  WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
))
WITH CHECK (program_id IN (
  SELECT id FROM public.ipm_programs 
  WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
));

-- ============================================================================
-- 4. IPM Assignments - Links programs to families or locations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.ipm_programs(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('family', 'location')),
  target_family text,                           -- Plant family name (when target_type = 'family')
  target_location_id uuid REFERENCES public.nursery_locations(id) ON DELETE CASCADE,
  starts_at date NOT NULL,                      -- When the program starts
  ends_at date,                                 -- Calculated end date (starts_at + duration_weeks)
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Constraint to ensure proper target based on type
  CONSTRAINT ipm_assignments_target_check CHECK (
    (target_type = 'family' AND target_family IS NOT NULL AND target_location_id IS NULL) OR
    (target_type = 'location' AND target_location_id IS NOT NULL AND target_family IS NULL)
  )
);

-- Indexes for ipm_assignments
CREATE INDEX IF NOT EXISTS idx_ipm_assignments_org ON public.ipm_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_ipm_assignments_program ON public.ipm_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_ipm_assignments_location ON public.ipm_assignments(target_location_id) WHERE target_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ipm_assignments_family ON public.ipm_assignments(org_id, target_family) WHERE target_family IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ipm_assignments_active ON public.ipm_assignments(org_id, is_active, starts_at);

-- RLS for ipm_assignments
ALTER TABLE public.ipm_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org ipm_assignments" ON public.ipm_assignments;
CREATE POLICY "Users can view org ipm_assignments"
ON public.ipm_assignments FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage org ipm_assignments" ON public.ipm_assignments;
CREATE POLICY "Users can manage org ipm_assignments"
ON public.ipm_assignments FOR ALL
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- ============================================================================
-- 5. IPM Spot Treatments - Ad-hoc treatments (single or series)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_spot_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.ipm_products(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('batch', 'location')),
  target_batch_id uuid REFERENCES public.batches(id) ON DELETE CASCADE,
  target_location_id uuid REFERENCES public.nursery_locations(id) ON DELETE CASCADE,
  applications_total int NOT NULL DEFAULT 1 CHECK (applications_total BETWEEN 1 AND 3),
  applications_completed int NOT NULL DEFAULT 0,
  application_interval_days int,                -- Days between applications for series
  first_application_date date NOT NULL,
  next_application_date date,                   -- Calculated next due date
  rate numeric,
  rate_unit text,
  method text,
  reason text,                                  -- Why this spot treatment is needed
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Constraint to ensure proper target based on type
  CONSTRAINT ipm_spot_treatments_target_check CHECK (
    (target_type = 'batch' AND target_batch_id IS NOT NULL) OR
    (target_type = 'location' AND target_location_id IS NOT NULL)
  )
);

-- Indexes for ipm_spot_treatments
CREATE INDEX IF NOT EXISTS idx_ipm_spot_treatments_org ON public.ipm_spot_treatments(org_id);
CREATE INDEX IF NOT EXISTS idx_ipm_spot_treatments_batch ON public.ipm_spot_treatments(target_batch_id) WHERE target_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ipm_spot_treatments_location ON public.ipm_spot_treatments(target_location_id) WHERE target_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ipm_spot_treatments_next ON public.ipm_spot_treatments(org_id, next_application_date, status);
CREATE INDEX IF NOT EXISTS idx_ipm_spot_treatments_status ON public.ipm_spot_treatments(org_id, status);

-- RLS for ipm_spot_treatments
ALTER TABLE public.ipm_spot_treatments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org ipm_spot_treatments" ON public.ipm_spot_treatments;
CREATE POLICY "Users can view org ipm_spot_treatments"
ON public.ipm_spot_treatments FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage org ipm_spot_treatments" ON public.ipm_spot_treatments;
CREATE POLICY "Users can manage org ipm_spot_treatments"
ON public.ipm_spot_treatments FOR ALL
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- ============================================================================
-- 6. Extend plant_health_logs to link to IPM entities
-- ============================================================================
ALTER TABLE public.plant_health_logs
  ADD COLUMN IF NOT EXISTS ipm_product_id uuid REFERENCES public.ipm_products(id),
  ADD COLUMN IF NOT EXISTS spot_treatment_id uuid REFERENCES public.ipm_spot_treatments(id),
  ADD COLUMN IF NOT EXISTS application_number int;  -- 1, 2, or 3 for series

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_plant_health_logs_ipm_product ON public.plant_health_logs(ipm_product_id) WHERE ipm_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plant_health_logs_spot_treatment ON public.plant_health_logs(spot_treatment_id) WHERE spot_treatment_id IS NOT NULL;

-- ============================================================================
-- 7. Helper function to calculate next application date for spot treatments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_spot_treatment_next_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If treatment is completed or cancelled, clear next date
  IF NEW.status IN ('completed', 'cancelled') THEN
    NEW.next_application_date = NULL;
  -- If still has applications remaining
  ELSIF NEW.applications_completed < NEW.applications_total THEN
    IF NEW.applications_completed = 0 THEN
      NEW.next_application_date = NEW.first_application_date;
    ELSIF NEW.application_interval_days IS NOT NULL THEN
      NEW.next_application_date = NEW.first_application_date + 
        (NEW.applications_completed * NEW.application_interval_days * INTERVAL '1 day');
    ELSE
      NEW.next_application_date = NULL;
    END IF;
  ELSE
    -- All applications completed
    NEW.status = 'completed';
    NEW.next_application_date = NULL;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_spot_treatment_next_date ON public.ipm_spot_treatments;
CREATE TRIGGER trg_spot_treatment_next_date
BEFORE INSERT OR UPDATE ON public.ipm_spot_treatments
FOR EACH ROW
EXECUTE FUNCTION public.update_spot_treatment_next_date();

-- ============================================================================
-- 8. View for upcoming treatments (combines programs and spot treatments)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_upcoming_ipm_treatments AS
-- Spot treatments
SELECT 
  st.org_id,
  'spot' as treatment_source,
  st.id as source_id,
  st.next_application_date as due_date,
  p.name as product_name,
  p.id as product_id,
  st.rate,
  st.rate_unit,
  st.method,
  st.target_type,
  st.target_batch_id,
  st.target_location_id,
  st.application_number as current_application,
  st.applications_total,
  st.reason as notes,
  l.name as location_name,
  b.batch_number
FROM public.ipm_spot_treatments st
JOIN public.ipm_products p ON st.product_id = p.id
LEFT JOIN public.nursery_locations l ON st.target_location_id = l.id
LEFT JOIN public.batches b ON st.target_batch_id = b.id
WHERE st.status IN ('scheduled', 'in_progress')
  AND st.next_application_date IS NOT NULL;

COMMENT ON TABLE public.ipm_products IS 'Master database of IPM products with regulatory info, rates, and restrictions';
COMMENT ON TABLE public.ipm_programs IS 'Reusable interval-based treatment programs';
COMMENT ON TABLE public.ipm_program_steps IS 'Products/steps within an IPM program';
COMMENT ON TABLE public.ipm_assignments IS 'Links IPM programs to plant families or locations';
COMMENT ON TABLE public.ipm_spot_treatments IS 'Ad-hoc spot treatments (single or series of 1-3 applications)';

