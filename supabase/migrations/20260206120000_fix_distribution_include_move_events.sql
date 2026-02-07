-- Fix get_batch_distribution:
-- 1. Include partial MOVE events as transplanted stock (previously only TRANSPLANT_OUT/TRANSPLANT_TO)
-- 2. Include CONSUMED events as transplanted stock (transplant actualization)
-- 3. Use correct allocation_status enum values ('allocated' only, not 'reserved' which doesn't exist)

CREATE OR REPLACE FUNCTION get_batch_distribution(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_quantity integer;
  v_reserved_quantity integer;
  v_allocated_sales integer := 0;
  v_sold integer := 0;
  v_dumped integer := 0;
  v_transplanted integer := 0;
  v_moved_out integer := 0;
  v_consumed integer := 0;
  v_available integer;
  v_total_accounted integer;
BEGIN
  -- Get batch basic info
  SELECT quantity, COALESCE(reserved_quantity, 0)
  INTO v_quantity, v_reserved_quantity
  FROM batches
  WHERE id = p_batch_id;

  IF v_quantity IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get sales allocations ('allocated' is the only valid enum value for reserved stock)
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_allocated_sales
  FROM batch_allocations
  WHERE batch_id = p_batch_id AND status = 'allocated';

  -- Get sold (picked status)
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_sold
  FROM batch_allocations
  WHERE batch_id = p_batch_id AND status = 'picked';

  -- Get dumped/loss from batch_events
  SELECT COALESCE(SUM(
    ABS(COALESCE(
      CASE
        WHEN jsonb_typeof(payload) = 'object' THEN
          COALESCE(
            (payload->>'qty')::integer,
            (payload->>'quantity')::integer,
            (payload->>'units')::integer,
            (payload->>'units_dumped')::integer
          )
        WHEN jsonb_typeof(payload) = 'string' THEN
          COALESCE(
            ((payload #>> '{}')::jsonb->>'qty')::integer,
            ((payload #>> '{}')::jsonb->>'quantity')::integer,
            ((payload #>> '{}')::jsonb->>'units')::integer,
            ((payload #>> '{}')::jsonb->>'units_dumped')::integer
          )
        ELSE NULL
      END,
      0
    ))
  ), 0)
  INTO v_dumped
  FROM batch_events
  WHERE batch_id = p_batch_id AND type IN ('LOSS', 'DUMP');

  -- Get transplanted out from TRANSPLANT_OUT/TRANSPLANT_TO events
  SELECT COALESCE(SUM(
    COALESCE(
      CASE
        WHEN jsonb_typeof(payload) = 'object' THEN
          COALESCE(
            (payload->>'units_moved')::integer,
            (payload->>'quantity')::integer,
            (payload->>'qty')::integer
          )
        WHEN jsonb_typeof(payload) = 'string' THEN
          COALESCE(
            ((payload #>> '{}')::jsonb->>'units_moved')::integer,
            ((payload #>> '{}')::jsonb->>'quantity')::integer,
            ((payload #>> '{}')::jsonb->>'qty')::integer
          )
        ELSE NULL
      END,
      0
    )
  ), 0)
  INTO v_transplanted
  FROM batch_events
  WHERE batch_id = p_batch_id AND type IN ('TRANSPLANT_OUT', 'TRANSPLANT_TO');

  -- Get moved out from partial MOVE events (batch splits)
  -- Only count MOVE events that have split_batch_id (partial moves that created new batches)
  -- Full location moves (no split_batch_id) don't change stock
  SELECT COALESCE(SUM(
    COALESCE(
      CASE
        WHEN jsonb_typeof(payload) = 'object' THEN
          CASE WHEN payload->>'split_batch_id' IS NOT NULL THEN
            COALESCE(
              (payload->>'units_moved')::integer,
              (payload->>'quantity')::integer,
              (payload->>'qty')::integer
            )
          ELSE NULL END
        WHEN jsonb_typeof(payload) = 'string' THEN
          CASE WHEN (payload #>> '{}')::jsonb->>'split_batch_id' IS NOT NULL THEN
            COALESCE(
              ((payload #>> '{}')::jsonb->>'units_moved')::integer,
              ((payload #>> '{}')::jsonb->>'quantity')::integer,
              ((payload #>> '{}')::jsonb->>'qty')::integer
            )
          ELSE NULL END
        ELSE NULL
      END,
      0
    )
  ), 0)
  INTO v_moved_out
  FROM batch_events
  WHERE batch_id = p_batch_id AND type = 'MOVE';

  -- Get consumed by transplant actualization (CONSUMED events)
  -- Source batch stock is consumed when a planned transplant is actualized
  SELECT COALESCE(SUM(
    COALESCE(
      CASE
        WHEN jsonb_typeof(payload) = 'object' THEN
          COALESCE(
            (payload->>'consumedQuantity')::integer,
            (payload->>'quantity')::integer,
            (payload->>'qty')::integer
          )
        WHEN jsonb_typeof(payload) = 'string' THEN
          COALESCE(
            ((payload #>> '{}')::jsonb->>'consumedQuantity')::integer,
            ((payload #>> '{}')::jsonb->>'quantity')::integer,
            ((payload #>> '{}')::jsonb->>'qty')::integer
          )
        ELSE NULL
      END,
      0
    )
  ), 0)
  INTO v_consumed
  FROM batch_events
  WHERE batch_id = p_batch_id AND type = 'CONSUMED';

  -- Combine all transplant-type outflows
  v_transplanted := v_transplanted + v_moved_out + v_consumed;

  -- Calculate available (current quantity - sales allocations - potting reservations)
  v_available := GREATEST(0, v_quantity - v_allocated_sales - v_reserved_quantity);

  -- Total accounted
  v_total_accounted := v_available + v_reserved_quantity + v_allocated_sales + v_sold + v_dumped + v_transplanted;

  RETURN jsonb_build_object(
    'available', v_available,
    'allocatedPotting', v_reserved_quantity,
    'allocatedSales', v_allocated_sales,
    'sold', v_sold,
    'dumped', v_dumped,
    'transplanted', v_transplanted,
    'totalAccounted', v_total_accounted
  );
END;
$$;
