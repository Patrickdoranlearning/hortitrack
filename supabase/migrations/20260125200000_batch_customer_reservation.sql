-- Add customer reservation to batches
-- Batches with reserved_for_customer_id set are only available for that customer
-- NULL means available to all customers

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS reserved_for_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_batches_reserved_customer
  ON batches(org_id, reserved_for_customer_id)
  WHERE reserved_for_customer_id IS NOT NULL;

-- Comment explaining the field
COMMENT ON COLUMN public.batches.reserved_for_customer_id IS
  'Customer ID this batch is reserved for (contract growing). NULL = available to all customers.';
