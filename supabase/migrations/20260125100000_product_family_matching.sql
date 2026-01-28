-- Add match_families column to products table for automatic variety/batch linking
-- Products like "1.5L Heather" can specify multiple families to match against

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS match_families text[];

-- GIN index for efficient array containment queries
CREATE INDEX IF NOT EXISTS idx_products_match_families ON products USING GIN(match_families)
  WHERE match_families IS NOT NULL;

-- Comment explaining the field
COMMENT ON COLUMN public.products.match_families IS
  'Array of plant families to auto-match batches. E.g., ["Erica Carnea", "Calluna", "Daboecia"] for heathers.';
