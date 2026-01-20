-- Remove Chemical Categories from Materials Module
-- Chemicals are now managed exclusively through the IPM/Plant Health module
-- This enforces clear domain separation:
--   Materials: pots, trays, soil, labels (production inputs)
--   IPM: pesticides, fertilizers, biologicals (plant treatment chemicals)

-------------------------------------------------------------------------------
-- 1. Delete any materials using chemical categories
-------------------------------------------------------------------------------

DELETE FROM public.materials
WHERE category_id IN (
  SELECT id FROM public.material_categories
  WHERE code IN ('FRT', 'PST', 'BIO')
);

-------------------------------------------------------------------------------
-- 2. Delete the chemical categories
-------------------------------------------------------------------------------

DELETE FROM public.material_categories
WHERE code IN ('FRT', 'PST', 'BIO');
