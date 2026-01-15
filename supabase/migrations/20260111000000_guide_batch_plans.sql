-- Guide Plans & Batch Plans for Production Planning Hierarchy
-- Guide Plan (high-level target) → Batch Plan (variety breakdown) → Batches (execution)

BEGIN;

-- ============================================================================
-- 1. Guide Plans table (high-level production targets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.guide_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Target (Family + Size level)
  target_family TEXT NOT NULL,           -- e.g., "Erica X Darleyensis"
  target_size_id UUID REFERENCES public.plant_sizes(id),

  -- Timeline (absolute years, can span year boundary e.g., W45 2026 → W06 2027)
  ready_from_week INT NOT NULL CHECK (ready_from_week BETWEEN 1 AND 53),
  ready_from_year INT NOT NULL CHECK (ready_from_year >= 2020),
  ready_to_week INT NOT NULL CHECK (ready_to_week BETWEEN 1 AND 53),
  ready_to_year INT NOT NULL CHECK (ready_to_year >= 2020),

  -- Recipe link (optional)
  protocol_id UUID REFERENCES public.protocols(id) ON DELETE SET NULL,

  -- Quantity target
  target_quantity INT NOT NULL CHECK (target_quantity > 0),

  -- Status: draft, active, completed, cancelled
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS guide_plans_org_id_idx ON public.guide_plans(org_id);
CREATE INDEX IF NOT EXISTS guide_plans_status_idx ON public.guide_plans(status);
CREATE INDEX IF NOT EXISTS guide_plans_target_family_idx ON public.guide_plans(target_family);
CREATE INDEX IF NOT EXISTS guide_plans_ready_year_idx ON public.guide_plans(ready_from_year, ready_to_year);

-- RLS
ALTER TABLE public.guide_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org guide_plans" ON public.guide_plans;
CREATE POLICY "Users can view org guide_plans" ON public.guide_plans
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage org guide_plans" ON public.guide_plans;
CREATE POLICY "Users can manage org guide_plans" ON public.guide_plans
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (SELECT auth.uid()))
  );

-- ============================================================================
-- 2. Batch Plans table (variety-level breakdown)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.batch_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  guide_plan_id UUID REFERENCES public.guide_plans(id) ON DELETE CASCADE,  -- Optional link

  -- Target (Variety level)
  plant_variety_id UUID NOT NULL REFERENCES public.plant_varieties(id),
  target_size_id UUID REFERENCES public.plant_sizes(id),

  -- Quantity
  planned_quantity INT NOT NULL CHECK (planned_quantity > 0),

  -- Timeline (inherited from guide plan or set manually, absolute years)
  ready_from_week INT CHECK (ready_from_week IS NULL OR ready_from_week BETWEEN 1 AND 53),
  ready_from_year INT CHECK (ready_from_year IS NULL OR ready_from_year >= 2020),
  ready_to_week INT CHECK (ready_to_week IS NULL OR ready_to_week BETWEEN 1 AND 53),
  ready_to_year INT CHECK (ready_to_year IS NULL OR ready_to_year >= 2020),

  -- Recipe link (optional, can inherit from guide plan)
  protocol_id UUID REFERENCES public.protocols(id) ON DELETE SET NULL,

  -- Status: draft, active, completed
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS batch_plans_org_id_idx ON public.batch_plans(org_id);
CREATE INDEX IF NOT EXISTS batch_plans_guide_plan_id_idx ON public.batch_plans(guide_plan_id);
CREATE INDEX IF NOT EXISTS batch_plans_variety_idx ON public.batch_plans(plant_variety_id);
CREATE INDEX IF NOT EXISTS batch_plans_status_idx ON public.batch_plans(status);

-- RLS
ALTER TABLE public.batch_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org batch_plans" ON public.batch_plans;
CREATE POLICY "Users can view org batch_plans" ON public.batch_plans
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage org batch_plans" ON public.batch_plans;
CREATE POLICY "Users can manage org batch_plans" ON public.batch_plans
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (SELECT auth.uid()))
  );

-- ============================================================================
-- 3. Extend batches table with batch_plan_id
-- ============================================================================
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS batch_plan_id UUID REFERENCES public.batch_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS batches_batch_plan_id_idx ON public.batches(batch_plan_id);

-- ============================================================================
-- 4. Helper function to calculate guide plan progress
-- ============================================================================
CREATE OR REPLACE FUNCTION get_guide_plan_progress(p_guide_plan_id UUID)
RETURNS TABLE (
  guide_plan_id UUID,
  target_quantity INT,
  total_planned BIGINT,
  total_in_batches BIGINT,
  total_completed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gp.id as guide_plan_id,
    gp.target_quantity,
    COALESCE(SUM(bp.planned_quantity), 0)::BIGINT as total_planned,
    COALESCE((
      SELECT SUM(b.quantity)
      FROM public.batches b
      INNER JOIN public.batch_plans bp2 ON b.batch_plan_id = bp2.id
      WHERE bp2.guide_plan_id = gp.id
        AND b.status NOT IN ('Archived', 'Dumped')
    ), 0)::BIGINT as total_in_batches,
    COALESCE((
      SELECT SUM(b.quantity)
      FROM public.batches b
      INNER JOIN public.batch_plans bp2 ON b.batch_plan_id = bp2.id
      WHERE bp2.guide_plan_id = gp.id
        AND b.status IN ('Ready', 'Shipped')
    ), 0)::BIGINT as total_completed
  FROM public.guide_plans gp
  LEFT JOIN public.batch_plans bp ON bp.guide_plan_id = gp.id
  WHERE gp.id = p_guide_plan_id
  GROUP BY gp.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Helper function to get batch plan progress
-- ============================================================================
CREATE OR REPLACE FUNCTION get_batch_plan_progress(p_batch_plan_id UUID)
RETURNS TABLE (
  batch_plan_id UUID,
  planned_quantity INT,
  batch_count BIGINT,
  total_in_batches BIGINT,
  total_completed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bp.id as batch_plan_id,
    bp.planned_quantity,
    COUNT(b.id)::BIGINT as batch_count,
    COALESCE(SUM(CASE WHEN b.status NOT IN ('Archived', 'Dumped') THEN b.quantity ELSE 0 END), 0)::BIGINT as total_in_batches,
    COALESCE(SUM(CASE WHEN b.status IN ('Ready', 'Shipped') THEN b.quantity ELSE 0 END), 0)::BIGINT as total_completed
  FROM public.batch_plans bp
  LEFT JOIN public.batches b ON b.batch_plan_id = bp.id
  WHERE bp.id = p_batch_plan_id
  GROUP BY bp.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
