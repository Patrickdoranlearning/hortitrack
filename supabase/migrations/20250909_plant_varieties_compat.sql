-- Compat view to expose lower-case 'category' for UI without renaming the base column
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

COMMENT ON VIEW public.plant_varieties_compat
  IS 'UI-compat view exposing lower-case category from plant_varieties."Category"';
