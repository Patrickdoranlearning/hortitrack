-- Add per-product quantity overrides for shelf and trolley quantities
-- This allows products with different heights (but same pot size) to have different trolley capacities

ALTER TABLE products
  ADD COLUMN shelf_quantity_override integer,
  ADD COLUMN trolley_quantity_override integer;

-- Add helpful comments
COMMENT ON COLUMN products.shelf_quantity_override IS
  'Override shelf quantity for this product (null = use size default from plant_sizes)';
COMMENT ON COLUMN products.trolley_quantity_override IS
  'Override trolley quantity for this product (null = use size default from plant_sizes)';
