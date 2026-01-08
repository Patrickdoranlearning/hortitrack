-- Planned Batch Materials
-- Junction table to store material requirements for planned batches
-- This enables production planning to specify containers (pots, trays) and growing media (compost, soil)

-- 1. Create the planned_batch_materials table
CREATE TABLE IF NOT EXISTS public.planned_batch_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id),
  quantity_planned NUMERIC NOT NULL CHECK (quantity_planned > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate material entries per batch
  CONSTRAINT planned_batch_materials_unique UNIQUE (batch_id, material_id)
);

-- 2. Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS planned_batch_materials_org_id_idx 
  ON public.planned_batch_materials(org_id);
  
CREATE INDEX IF NOT EXISTS planned_batch_materials_batch_id_idx 
  ON public.planned_batch_materials(batch_id);
  
CREATE INDEX IF NOT EXISTS planned_batch_materials_material_id_idx 
  ON public.planned_batch_materials(material_id);

-- 3. Enable Row Level Security
ALTER TABLE public.planned_batch_materials ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS "Users can view org planned batch materials" ON public.planned_batch_materials;
CREATE POLICY "Users can view org planned batch materials"
ON public.planned_batch_materials
FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage org planned batch materials" ON public.planned_batch_materials;
CREATE POLICY "Users can manage org planned batch materials"
ON public.planned_batch_materials
FOR ALL
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
  )
);

-- 5. Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_batch_materials TO authenticated;

-- 6. Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_planned_batch_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS planned_batch_materials_updated_at_trigger ON public.planned_batch_materials;
CREATE TRIGGER planned_batch_materials_updated_at_trigger
  BEFORE UPDATE ON public.planned_batch_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_planned_batch_materials_updated_at();

-- 7. Add comment for documentation
COMMENT ON TABLE public.planned_batch_materials IS 
  'Stores planned material requirements for production batches. Used during batch planning to specify containers, growing media, etc.';

