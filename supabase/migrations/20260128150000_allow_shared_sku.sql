-- Allow multiple products to share the same SKU
-- This supports the product hierarchy where:
--   SKU = Container Size + Category (e.g., "1L Heather")
--   Product = SKU + Genus (e.g., "1L Erica", "1L Calluna")

-- Remove the unique constraint on sku_id
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_sku_id_key;

-- Add a regular index for performance (not unique)
CREATE INDEX IF NOT EXISTS idx_products_sku_id ON public.products(sku_id);

COMMENT ON COLUMN public.products.sku_id IS 'SKU reference - multiple products can share the same SKU (e.g., 1L Erica and 1L Calluna both use 1L Heather SKU)';
