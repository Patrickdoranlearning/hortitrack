-- Atomically decrement batch quantity; fails if insufficient.
CREATE OR REPLACE FUNCTION public.decrement_batch_quantity(
  p_org_id uuid,
  p_batch_id uuid,
  p_units integer
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE v_new_qty integer;
BEGIN
  IF p_units <= 0 THEN
    RAISE EXCEPTION 'Units to decrement must be > 0';
  END IF;

  UPDATE public.batches
     SET quantity = quantity - p_units,
         updated_at = now()
   WHERE id = p_batch_id
     AND org_id = p_org_id
     AND quantity >= p_units
   RETURNING quantity INTO v_new_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient quantity or batch not found';
  END IF;

  RETURN v_new_qty;
END;
$$;
