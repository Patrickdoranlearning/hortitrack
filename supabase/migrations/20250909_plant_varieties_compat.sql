-- Compat view to expose lowercase 'category' for UI
CREATE OR REPLACE VIEW public.plant_varieties_compat AS
SELECT
  id,
  name,
  family,
  genus,
  species,
  "Category" AS category,
  colour,
  rating,
  created_at,
  updated_at
FROM public.plant_varieties;

-- Optional: make it easy to SELECT (no writes on a view)
COMMENT ON VIEW public.plant_varieties_compat IS 'UI-compat view exposing lower-case category';
