-- ============================================================================
-- Scientific Trials Module for HortiTrack
-- Enables A/B/C comparison trials with control/treatment groups
-- ============================================================================

-- ============================================================================
-- 1. TRIAL STATUS ENUM
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trial_status') THEN
    CREATE TYPE trial_status AS ENUM (
      'draft',        -- Being set up
      'active',       -- Currently running
      'paused',       -- Temporarily suspended
      'completed',    -- All measurements done
      'archived'      -- Historical record
    );
  END IF;
END$$;

-- ============================================================================
-- 2. TRIALS TABLE - Main trial records
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Basic Info
  trial_number text NOT NULL,              -- e.g., "TRL-2025-001"
  name text NOT NULL,
  description text,

  -- Scientific Context
  hypothesis text,                          -- What we're testing
  objective text,                           -- What we want to learn
  methodology text,                         -- How we'll conduct the trial

  -- Trial Subject
  variety_id uuid REFERENCES public.plant_varieties(id),
  target_size_id uuid REFERENCES public.plant_sizes(id),

  -- Timing
  start_date date,
  planned_end_date date,
  actual_end_date date,
  measurement_frequency_days int NOT NULL DEFAULT 7, -- Weekly by default

  -- Status
  status trial_status NOT NULL DEFAULT 'draft',

  -- Linked Protocol (for production recipe improvement)
  protocol_id uuid REFERENCES public.protocols(id),

  -- Location
  trial_location_id uuid REFERENCES public.nursery_locations(id),

  -- Audit
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trials_org ON public.trials(org_id);
CREATE INDEX IF NOT EXISTS idx_trials_status ON public.trials(org_id, status);
CREATE INDEX IF NOT EXISTS idx_trials_variety ON public.trials(variety_id);
CREATE INDEX IF NOT EXISTS idx_trials_protocol ON public.trials(protocol_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trials_number ON public.trials(org_id, trial_number);

-- RLS
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org trials" ON public.trials;
CREATE POLICY "Users can view org trials"
ON public.trials FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage org trials" ON public.trials;
CREATE POLICY "Users can manage org trials"
ON public.trials FOR ALL
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- ============================================================================
-- 3. TRIAL GROUPS TABLE - Control and treatment groups
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trial_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_id uuid NOT NULL REFERENCES public.trials(id) ON DELETE CASCADE,

  -- Group Identity
  name text NOT NULL,                       -- e.g., "Control", "Treatment A", "Treatment B"
  group_type text NOT NULL CHECK (group_type IN ('control', 'treatment')),
  sort_order int NOT NULL DEFAULT 0,

  -- Group Description
  description text,                         -- What makes this group different

  -- Strategy Details (JSONB for flexibility)
  strategy jsonb NOT NULL DEFAULT '{}',
  -- Example strategy:
  -- {
  --   "ipmProducts": [{"id": "uuid", "name": "Product X", "rate": 5, "rateUnit": "ml/L"}],
  --   "materials": [{"id": "uuid", "name": "Fertilizer Y", "rate": 10}],
  --   "protocolId": "uuid",
  --   "customTreatments": [{"name": "Extra watering", "frequency": "daily"}]
  -- }

  -- Target Size
  target_plant_count int NOT NULL DEFAULT 3, -- Number of plants in this group

  -- Visual Identifier
  label_color text,                         -- For visual identification in UI

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trial_groups_trial ON public.trial_groups(trial_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_groups_order ON public.trial_groups(trial_id, sort_order);

-- RLS (inherits from trial)
ALTER TABLE public.trial_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view trial groups" ON public.trial_groups;
CREATE POLICY "Users can view trial groups"
ON public.trial_groups FOR SELECT
USING (trial_id IN (
  SELECT id FROM public.trials
  WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
));

DROP POLICY IF EXISTS "Users can manage trial groups" ON public.trial_groups;
CREATE POLICY "Users can manage trial groups"
ON public.trial_groups FOR ALL
USING (trial_id IN (
  SELECT id FROM public.trials
  WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
))
WITH CHECK (trial_id IN (
  SELECT id FROM public.trials
  WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
));

-- ============================================================================
-- 4. TRIAL SUBJECTS TABLE - Individual plants/batches in each group
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trial_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.trial_groups(id) ON DELETE CASCADE,

  -- Subject Identity
  subject_number int NOT NULL,              -- 1, 2, 3 within group
  label text,                               -- e.g., "Control-1", "TreatmentA-2"

  -- Link to Production System
  batch_id uuid REFERENCES public.batches(id),  -- Optional link to existing batch

  -- Individual Plant Tracking (for dedicated trial plants)
  plant_identifier text,                    -- Physical tag/label on the plant

  -- Location
  location_id uuid REFERENCES public.nursery_locations(id),
  position_notes text,                      -- "Row 3, Position 5"

  -- Starting Metrics (baseline)
  initial_height_cm numeric(6,2),
  initial_leaf_count int,
  initial_vigor_score int CHECK (initial_vigor_score BETWEEN 1 AND 5),
  initial_photo_url text,

  -- Status
  is_active boolean NOT NULL DEFAULT true,
  dropout_reason text,                      -- If removed from trial
  dropout_date date,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trial_subjects_group ON public.trial_subjects(group_id);
CREATE INDEX IF NOT EXISTS idx_trial_subjects_batch ON public.trial_subjects(batch_id) WHERE batch_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_subjects_number ON public.trial_subjects(group_id, subject_number);

-- RLS (inherits from group -> trial)
ALTER TABLE public.trial_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view trial subjects" ON public.trial_subjects;
CREATE POLICY "Users can view trial subjects"
ON public.trial_subjects FOR SELECT
USING (group_id IN (
  SELECT id FROM public.trial_groups WHERE trial_id IN (
    SELECT id FROM public.trials
    WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  )
));

DROP POLICY IF EXISTS "Users can manage trial subjects" ON public.trial_subjects;
CREATE POLICY "Users can manage trial subjects"
ON public.trial_subjects FOR ALL
USING (group_id IN (
  SELECT id FROM public.trial_groups WHERE trial_id IN (
    SELECT id FROM public.trials
    WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  )
))
WITH CHECK (group_id IN (
  SELECT id FROM public.trial_groups WHERE trial_id IN (
    SELECT id FROM public.trials
    WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  )
));

-- ============================================================================
-- 5. TRIAL MEASUREMENTS TABLE - Weekly data collection per subject
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trial_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.trial_subjects(id) ON DELETE CASCADE,

  -- Timing
  measurement_date date NOT NULL,
  week_number int NOT NULL,                 -- Week 0, 1, 2, etc.

  -- Growth Metrics
  height_cm numeric(6,2),
  stem_diameter_mm numeric(5,2),
  leaf_count int,
  root_score int CHECK (root_score BETWEEN 1 AND 5),  -- Visual root development score
  biomass_g numeric(8,2),                   -- If measured (destructive)
  canopy_width_cm numeric(6,2),
  internode_length_mm numeric(5,2),

  -- Environmental Readings
  ec numeric(5,2),
  ph numeric(4,2),
  temperature_c numeric(5,2),
  humidity_pct numeric(5,2),
  light_level_lux int,

  -- Visual Assessments (1-5 scale)
  color_score int CHECK (color_score BETWEEN 1 AND 5),
  vigor_score int CHECK (vigor_score BETWEEN 1 AND 5),
  pest_score int CHECK (pest_score BETWEEN 1 AND 5),       -- 5=no pests, 1=severe
  disease_score int CHECK (disease_score BETWEEN 1 AND 5), -- 5=healthy, 1=severe
  overall_health_score int CHECK (overall_health_score BETWEEN 1 AND 5),

  -- Yield Data
  flowers_count int,
  fruits_count int,
  harvest_weight_g numeric(8,2),
  quality_grade text CHECK (quality_grade IN ('A', 'B', 'C', 'cull')),

  -- Media
  photo_urls text[],

  -- Notes
  observations text,
  anomalies text,

  -- Audit
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trial_measurements_subject ON public.trial_measurements(subject_id);
CREATE INDEX IF NOT EXISTS idx_trial_measurements_date ON public.trial_measurements(measurement_date);
CREATE INDEX IF NOT EXISTS idx_trial_measurements_week ON public.trial_measurements(subject_id, week_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_measurements_subject_week ON public.trial_measurements(subject_id, week_number);

-- RLS (inherits through chain)
ALTER TABLE public.trial_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view trial measurements" ON public.trial_measurements;
CREATE POLICY "Users can view trial measurements"
ON public.trial_measurements FOR SELECT
USING (subject_id IN (
  SELECT id FROM public.trial_subjects WHERE group_id IN (
    SELECT id FROM public.trial_groups WHERE trial_id IN (
      SELECT id FROM public.trials
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    )
  )
));

DROP POLICY IF EXISTS "Users can manage trial measurements" ON public.trial_measurements;
CREATE POLICY "Users can manage trial measurements"
ON public.trial_measurements FOR ALL
USING (subject_id IN (
  SELECT id FROM public.trial_subjects WHERE group_id IN (
    SELECT id FROM public.trial_groups WHERE trial_id IN (
      SELECT id FROM public.trials
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    )
  )
))
WITH CHECK (subject_id IN (
  SELECT id FROM public.trial_subjects WHERE group_id IN (
    SELECT id FROM public.trial_groups WHERE trial_id IN (
      SELECT id FROM public.trials
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    )
  )
));

-- ============================================================================
-- 6. TRIAL TREATMENTS TABLE - Applied treatments log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trial_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.trial_groups(id) ON DELETE CASCADE,

  -- Treatment Details
  treatment_type text NOT NULL CHECK (treatment_type IN ('ipm', 'material', 'protocol', 'custom')),
  treatment_date date NOT NULL,

  -- Linked Entities (based on type)
  ipm_product_id uuid REFERENCES public.ipm_products(id),
  material_id uuid REFERENCES public.materials(id),
  protocol_id uuid REFERENCES public.protocols(id),

  -- Application Details
  name text NOT NULL,                       -- Product/material name
  rate numeric(10,4),
  rate_unit text,
  method text,                              -- "Foliar spray", "Drench", etc.
  quantity_applied numeric(10,4),

  -- Notes
  notes text,

  -- Audit
  applied_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trial_treatments_group ON public.trial_treatments(group_id);
CREATE INDEX IF NOT EXISTS idx_trial_treatments_date ON public.trial_treatments(treatment_date);
CREATE INDEX IF NOT EXISTS idx_trial_treatments_ipm ON public.trial_treatments(ipm_product_id) WHERE ipm_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_treatments_material ON public.trial_treatments(material_id) WHERE material_id IS NOT NULL;

-- RLS
ALTER TABLE public.trial_treatments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view trial treatments" ON public.trial_treatments;
CREATE POLICY "Users can view trial treatments"
ON public.trial_treatments FOR SELECT
USING (group_id IN (
  SELECT id FROM public.trial_groups WHERE trial_id IN (
    SELECT id FROM public.trials
    WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  )
));

DROP POLICY IF EXISTS "Users can manage trial treatments" ON public.trial_treatments;
CREATE POLICY "Users can manage trial treatments"
ON public.trial_treatments FOR ALL
USING (group_id IN (
  SELECT id FROM public.trial_groups WHERE trial_id IN (
    SELECT id FROM public.trials
    WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  )
))
WITH CHECK (group_id IN (
  SELECT id FROM public.trial_groups WHERE trial_id IN (
    SELECT id FROM public.trials
    WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  )
));

-- ============================================================================
-- 7. TRIAL FINDINGS TABLE - Documented outcomes and conclusions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trial_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_id uuid NOT NULL REFERENCES public.trials(id) ON DELETE CASCADE,

  -- Finding Details
  finding_type text NOT NULL CHECK (finding_type IN ('observation', 'conclusion', 'recommendation', 'action_item')),
  title text NOT NULL,
  description text NOT NULL,

  -- Supporting Data
  supporting_data jsonb,                    -- Statistical analysis, charts data, etc.

  -- Recommendations
  recommended_protocol_changes jsonb,       -- Suggested recipe modifications

  -- Status
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'implemented')),

  -- Implementation Tracking
  implemented_at timestamptz,
  implemented_protocol_id uuid REFERENCES public.protocols(id),

  -- Audit
  created_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trial_findings_trial ON public.trial_findings(trial_id);
CREATE INDEX IF NOT EXISTS idx_trial_findings_type ON public.trial_findings(trial_id, finding_type);

-- RLS
ALTER TABLE public.trial_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view trial findings" ON public.trial_findings;
CREATE POLICY "Users can view trial findings"
ON public.trial_findings FOR SELECT
USING (trial_id IN (
  SELECT id FROM public.trials
  WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
));

DROP POLICY IF EXISTS "Users can manage trial findings" ON public.trial_findings;
CREATE POLICY "Users can manage trial findings"
ON public.trial_findings FOR ALL
USING (trial_id IN (
  SELECT id FROM public.trials
  WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
))
WITH CHECK (trial_id IN (
  SELECT id FROM public.trials
  WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
));

-- ============================================================================
-- 8. HELPER FUNCTION: Generate trial number
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_trial_number(p_org_id uuid)
RETURNS text AS $$
DECLARE
  v_year text;
  v_seq int;
  v_number text;
BEGIN
  v_year := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(trial_number, '^TRL-' || v_year || '-', ''), '') AS int)
  ), 0) + 1
  INTO v_seq
  FROM public.trials
  WHERE org_id = p_org_id
    AND trial_number LIKE 'TRL-' || v_year || '-%';

  v_number := 'TRL-' || v_year || '-' || LPAD(v_seq::text, 3, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. VIEW: Trial summary with group statistics
-- ============================================================================
CREATE OR REPLACE VIEW public.v_trial_summary AS
SELECT
  t.id,
  t.org_id,
  t.trial_number,
  t.name,
  t.status,
  t.start_date,
  t.planned_end_date,
  v.name as variety_name,
  COUNT(DISTINCT tg.id) as group_count,
  COUNT(DISTINCT ts.id) as subject_count,
  COUNT(DISTINCT tm.id) as measurement_count,
  MAX(tm.measurement_date) as last_measurement_date,
  CASE
    WHEN t.start_date IS NOT NULL THEN
      FLOOR((CURRENT_DATE - t.start_date)::numeric / 7)::int
    ELSE 0
  END as current_week,
  t.created_at
FROM public.trials t
LEFT JOIN public.plant_varieties v ON t.variety_id = v.id
LEFT JOIN public.trial_groups tg ON t.id = tg.trial_id
LEFT JOIN public.trial_subjects ts ON tg.id = ts.group_id AND ts.is_active = true
LEFT JOIN public.trial_measurements tm ON ts.id = tm.subject_id
GROUP BY t.id, t.org_id, t.trial_number, t.name, t.status, t.start_date, t.planned_end_date, v.name, t.created_at;

-- ============================================================================
-- 10. GRANTS
-- ============================================================================
GRANT ALL ON public.trials TO authenticated;
GRANT ALL ON public.trial_groups TO authenticated;
GRANT ALL ON public.trial_subjects TO authenticated;
GRANT ALL ON public.trial_measurements TO authenticated;
GRANT ALL ON public.trial_treatments TO authenticated;
GRANT ALL ON public.trial_findings TO authenticated;
GRANT SELECT ON public.v_trial_summary TO authenticated;

-- ============================================================================
-- 11. COMMENTS
-- ============================================================================
COMMENT ON TABLE public.trials IS 'Main trial records for A/B/C comparison studies';
COMMENT ON TABLE public.trial_groups IS 'Control and treatment groups within a trial';
COMMENT ON TABLE public.trial_subjects IS 'Individual plants or batches being tracked in each group';
COMMENT ON TABLE public.trial_measurements IS 'Weekly measurement data for each trial subject';
COMMENT ON TABLE public.trial_treatments IS 'Log of treatments applied to each group';
COMMENT ON TABLE public.trial_findings IS 'Documented outcomes, conclusions, and recommendations';
