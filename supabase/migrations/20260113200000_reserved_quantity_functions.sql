-- Functions for atomic management of reserved_quantity on batches
-- Used when batches are linked/unlinked from batch plans

-- Increment reserved_quantity atomically
CREATE OR REPLACE FUNCTION public.increment_reserved_quantity(
  p_batch_id uuid,
  p_amount integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_reserved integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.batches
  SET reserved_quantity = COALESCE(reserved_quantity, 0) + p_amount
  WHERE id = p_batch_id
  RETURNING reserved_quantity INTO v_new_reserved;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_id;
  END IF;

  RETURN v_new_reserved;
END;
$$;

-- Decrement reserved_quantity atomically (with floor at 0)
CREATE OR REPLACE FUNCTION public.decrement_reserved_quantity(
  p_batch_id uuid,
  p_amount integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_reserved integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.batches
  SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_amount)
  WHERE id = p_batch_id
  RETURNING reserved_quantity INTO v_new_reserved;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_id;
  END IF;

  RETURN v_new_reserved;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_reserved_quantity(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_reserved_quantity(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.increment_reserved_quantity IS
  'Atomically increment reserved_quantity on a batch when linking to a plan';
COMMENT ON FUNCTION public.decrement_reserved_quantity IS
  'Atomically decrement reserved_quantity on a batch when unlinking from a plan (floors at 0)';
