-- Add saleable_quantity column to batches table
-- This tracks how many units in a batch are ready for sale
-- (vs still growing/not yet ready)

ALTER TABLE public.batches
ADD COLUMN IF NOT EXISTS saleable_quantity integer;

-- Comment
COMMENT ON COLUMN public.batches.saleable_quantity IS
  'Number of units currently saleable. NULL means all units are saleable (equals quantity). Allows partial saleability e.g. some in flower, some not.';

-- Add index for queries filtering by saleable quantity
CREATE INDEX IF NOT EXISTS batches_saleable_quantity_idx
ON public.batches (org_id, saleable_quantity)
WHERE saleable_quantity IS NOT NULL AND archived_at IS NULL;
