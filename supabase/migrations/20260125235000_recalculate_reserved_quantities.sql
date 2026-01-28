-- Recalculate reserved_quantity for all batches based on existing allocations
-- This fixes any batches where reserved_quantity wasn't updated due to the search_path bug

-- Update reserved_quantity to match the sum of active allocations
-- Only count allocations that aren't cancelled or shipped
UPDATE public.batches b
SET reserved_quantity = COALESCE(
  (
    SELECT SUM(ba.quantity)
    FROM public.batch_allocations ba
    WHERE ba.batch_id = b.id
      AND ba.status::text NOT IN ('cancelled', 'shipped')
  ),
  0
);

-- Log a comment about what was fixed
COMMENT ON TABLE public.batches IS
  'Plant batches. reserved_quantity recalculated in 20260125235000 to fix sync_reserved_quantity search_path issue.';
