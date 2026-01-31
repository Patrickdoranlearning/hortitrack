-- Fix create_order_with_allocations function overload ambiguity
--
-- Problem: Two versions of create_order_with_allocations exist with identical signatures
-- except for the p_status parameter type:
--   - Version 1: p_status text
--   - Version 2: p_status order_status (enum)
--
-- When calling with p_status: 'confirmed', PostgreSQL cannot determine which to use
-- because the string can be implicitly cast to both types.
--
-- Solution: Drop the 'text' version, keeping only the type-safe 'order_status' enum version.

-- Drop the text version of the function
DROP FUNCTION IF EXISTS public.create_order_with_allocations(
  uuid, uuid, text, jsonb, date, text, uuid, text, uuid, uuid
);

-- Verify only one version remains (the order_status version)
-- This is just a comment for documentation - the migration runner won't execute this
-- SELECT proname, pg_get_function_identity_arguments(oid)
-- FROM pg_proc WHERE proname = 'create_order_with_allocations';

COMMENT ON FUNCTION public.create_order_with_allocations(
  uuid, uuid, text, jsonb, date, text, uuid, order_status, uuid, uuid
) IS 'Atomically creates an order with line items and batch allocations.
Uses row-level locking to prevent race conditions on stock reservation.
Validates customer batch reservations - reserved batches can only be allocated to their designated customer.
Fixed: Removed duplicate text overload to resolve function ambiguity.';
