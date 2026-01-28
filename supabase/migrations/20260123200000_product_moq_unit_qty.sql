-- Add product-level MOQ and unit quantity
-- These allow overriding size defaults on a per-product basis

ALTER TABLE products
  ADD COLUMN min_order_qty integer DEFAULT 1 CHECK (min_order_qty > 0),
  ADD COLUMN unit_qty integer DEFAULT 1 CHECK (unit_qty > 0);

COMMENT ON COLUMN products.min_order_qty IS 'Minimum order quantity for this product';
COMMENT ON COLUMN products.unit_qty IS 'Unit of sale - quantities must be multiples of this (e.g., 6 for tray of 6)';
