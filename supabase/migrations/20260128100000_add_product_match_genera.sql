-- Add match_genera column to products table for genus-level batch matching
-- This enables the "Product = Genus + Size" pattern (e.g., "2L Lavender" matches all Lavandula varieties)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS match_genera text[];

COMMENT ON COLUMN public.products.match_genera IS
  'Array of genus names to auto-match batches. E.g., ["Lavandula"] matches all Lavender varieties (Munstead, Hidcote, etc.).';

-- Create GIN index for efficient array containment queries
CREATE INDEX IF NOT EXISTS idx_products_match_genera 
  ON public.products USING GIN (match_genera) 
  WHERE match_genera IS NOT NULL;
