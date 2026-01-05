-- Extend product_aliases to support variety-level aliases

ALTER TABLE public.product_aliases
  ADD COLUMN IF NOT EXISTS variety_id uuid REFERENCES public.plant_varieties(id),
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.product_aliases
  ADD CONSTRAINT IF NOT EXISTS product_aliases_target_check
    CHECK (product_id IS NOT NULL OR variety_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS product_aliases_variety_idx
  ON public.product_aliases(variety_id);






