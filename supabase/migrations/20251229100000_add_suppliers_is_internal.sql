-- Add is_internal column to suppliers table
-- This is used by perform_transplant to identify internal supplier for child batches

ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;

-- Create index for faster lookup of internal supplier
CREATE INDEX IF NOT EXISTS suppliers_is_internal_idx
ON public.suppliers (org_id, is_internal)
WHERE is_internal = true;

-- Comment
COMMENT ON COLUMN public.suppliers.is_internal IS
  'True for the internal supplier used for transplant/propagation batches';
