-- Atomically increment batch quantity (for restoring stock on QC rejection)
CREATE OR REPLACE FUNCTION public.increment_batch_quantity(
  p_org_id uuid,
  p_batch_id uuid,
  p_units integer
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE v_new_qty integer;
BEGIN
  IF p_units <= 0 THEN
    RAISE EXCEPTION 'Units to increment must be > 0';
  END IF;

  UPDATE public.batches
     SET quantity = quantity + p_units,
         updated_at = now()
   WHERE id = p_batch_id
     AND org_id = p_org_id
   RETURNING quantity INTO v_new_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;

  RETURN v_new_qty;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_batch_quantity(uuid, uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.increment_batch_quantity IS
  'Atomically increment batch quantity when restoring stock (e.g., QC rejection)';
