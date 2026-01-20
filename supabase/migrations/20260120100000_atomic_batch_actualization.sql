-- Atomic batch actualization function
-- Wraps all actualization steps in a single transaction to prevent partial updates
-- Fixes: DB-001 (transactions for multi-step operations) and DB-002 (race condition in reserved quantity)

-- Helper function to resolve status_id from attribute_options
CREATE OR REPLACE FUNCTION public.resolve_status_id(
  p_org_id uuid,
  p_status_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_id uuid;
BEGIN
  SELECT id INTO v_status_id
  FROM public.attribute_options
  WHERE org_id = p_org_id
    AND attribute_key = 'production_status'
    AND system_code ILIKE p_status_code
  LIMIT 1;

  IF v_status_id IS NULL THEN
    -- Create the status if it doesn't exist
    INSERT INTO public.attribute_options (org_id, attribute_key, system_code, label, sort_order)
    VALUES (p_org_id, 'production_status', p_status_code, p_status_code, 0)
    RETURNING id INTO v_status_id;
  END IF;

  RETURN v_status_id;
END;
$$;

-- Main actualization function for a single batch
CREATE OR REPLACE FUNCTION public.actualize_batch(
  p_org_id uuid,
  p_batch_id uuid,
  p_actual_quantity integer,
  p_actual_date date,
  p_user_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch record;
  v_growing_status_id uuid;
  v_quantity_diff integer;
  v_log_entry jsonb;
  v_updated_batch record;
BEGIN
  -- Get Growing status ID
  v_growing_status_id := public.resolve_status_id(p_org_id, 'Growing');

  -- Fetch and lock the batch for update
  SELECT * INTO v_batch
  FROM public.batches
  WHERE id = p_batch_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found or access denied: %', p_batch_id;
  END IF;

  -- Verify batch is in correct status
  IF v_batch.status NOT IN ('Planned', 'Incoming') THEN
    RAISE EXCEPTION 'Batch % is not in Planned/Incoming status (current: %)',
      v_batch.batch_number, v_batch.status;
  END IF;

  -- Calculate quantity difference
  v_quantity_diff := p_actual_quantity - COALESCE(v_batch.quantity, 0);

  -- Build log entry
  v_log_entry := jsonb_build_object(
    'type', 'actualized',
    'timestamp', now(),
    'userId', p_user_id,
    'previousStatus', v_batch.status,
    'newStatus', 'Growing',
    'plannedQuantity', v_batch.quantity,
    'actualQuantity', p_actual_quantity,
    'quantityDiff', v_quantity_diff,
    'actualDate', p_actual_date,
    'notes', p_notes
  );

  -- Update batch to Growing status
  UPDATE public.batches
  SET
    status = 'Growing',
    status_id = v_growing_status_id,
    quantity = p_actual_quantity,
    planted_at = p_actual_date,
    location_id = COALESCE(p_location_id, location_id),
    log_history = COALESCE(log_history, '[]'::jsonb) || v_log_entry,
    updated_at = now()
  WHERE id = p_batch_id
    AND org_id = p_org_id
  RETURNING * INTO v_updated_batch;

  -- Log event
  INSERT INTO public.batch_events (
    org_id,
    batch_id,
    type,
    by_user_id,
    payload
  ) VALUES (
    p_org_id,
    p_batch_id,
    'ACTUALIZED',
    p_user_id,
    jsonb_build_object(
      'previousStatus', v_batch.status,
      'plannedQuantity', v_batch.quantity,
      'actualQuantity', p_actual_quantity,
      'actualDate', p_actual_date,
      'locationId', p_location_id,
      'notes', p_notes
    )
  );

  -- If this is a transplant (has parent batch), update parent's quantity and reserved
  IF v_batch.parent_batch_id IS NOT NULL THEN
    -- Lock parent batch to prevent race conditions
    PERFORM 1 FROM public.batches
    WHERE id = v_batch.parent_batch_id
    FOR UPDATE;

    -- Atomically update parent batch quantities
    UPDATE public.batches
    SET
      quantity = GREATEST(0, COALESCE(quantity, 0) - p_actual_quantity),
      reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_actual_quantity),
      updated_at = now()
    WHERE id = v_batch.parent_batch_id;

    -- Log consumption on parent
    INSERT INTO public.batch_events (
      org_id,
      batch_id,
      type,
      by_user_id,
      payload
    ) VALUES (
      p_org_id,
      v_batch.parent_batch_id,
      'CONSUMED',
      p_user_id,
      jsonb_build_object(
        'consumedQuantity', p_actual_quantity,
        'consumedByBatch', p_batch_id,
        'reason', 'transplant_actualized'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'batch', jsonb_build_object(
      'id', v_updated_batch.id,
      'batch_number', v_updated_batch.batch_number,
      'status', v_updated_batch.status,
      'quantity', v_updated_batch.quantity,
      'planted_at', v_updated_batch.planted_at
    ),
    'previousStatus', v_batch.status,
    'quantityDiff', v_quantity_diff
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.resolve_status_id(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualize_batch(uuid, uuid, integer, date, uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.actualize_batch IS
  'Atomically actualize a batch: updates status to Growing, adjusts quantities,
   handles parent batch consumption for transplants, and logs all events.
   All operations are transactional - if any step fails, all changes are rolled back.';


-- Dispatch load atomic function
-- Wraps the multi-step dispatch operation in a single transaction
CREATE OR REPLACE FUNCTION public.dispatch_load(
  p_load_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ids uuid[];
  v_incomplete_count integer;
  v_incomplete_orders text;
BEGIN
  -- Get all order IDs in this load
  SELECT array_agg(order_id) INTO v_order_ids
  FROM public.delivery_items
  WHERE delivery_run_id = p_load_id;

  IF v_order_ids IS NULL OR array_length(v_order_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No orders in this load to dispatch');
  END IF;

  -- Check for incomplete pick lists
  SELECT
    COUNT(*),
    string_agg(o.order_number, ', ')
  INTO v_incomplete_count, v_incomplete_orders
  FROM public.pick_lists pl
  JOIN public.orders o ON o.id = pl.order_id
  WHERE pl.order_id = ANY(v_order_ids)
    AND pl.status != 'completed';

  IF v_incomplete_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Cannot dispatch - %s order(s) have incomplete picking: %s',
        v_incomplete_count, v_incomplete_orders)
    );
  END IF;

  -- Lock the delivery run to prevent concurrent modifications
  PERFORM 1 FROM public.delivery_runs WHERE id = p_load_id FOR UPDATE;

  -- Update delivery run status
  UPDATE public.delivery_runs
  SET
    status = 'in_transit',
    actual_departure_time = now()
  WHERE id = p_load_id;

  -- Update all delivery items
  UPDATE public.delivery_items
  SET status = 'in_transit'
  WHERE delivery_run_id = p_load_id;

  -- Update all orders to dispatched
  UPDATE public.orders
  SET status = 'dispatched'
  WHERE id = ANY(v_order_ids);

  RETURN jsonb_build_object(
    'success', true,
    'ordersDispatched', array_length(v_order_ids, 1)
  );
END;
$$;

-- Recall load atomic function
CREATE OR REPLACE FUNCTION public.recall_load(
  p_load_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_load record;
  v_order_ids uuid[];
BEGIN
  -- Lock and get load status
  SELECT * INTO v_load
  FROM public.delivery_runs
  WHERE id = p_load_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Load not found');
  END IF;

  IF v_load.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot recall a completed load. Use reschedule instead.');
  END IF;

  IF v_load.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot recall a cancelled load');
  END IF;

  -- Get order IDs
  SELECT array_agg(order_id) INTO v_order_ids
  FROM public.delivery_items
  WHERE delivery_run_id = p_load_id;

  -- Reset delivery run
  UPDATE public.delivery_runs
  SET
    status = 'loading',
    actual_departure_time = NULL
  WHERE id = p_load_id;

  -- Reset delivery items
  UPDATE public.delivery_items
  SET status = 'pending'
  WHERE delivery_run_id = p_load_id;

  -- Reset orders to packed status
  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    UPDATE public.orders
    SET status = 'packed'
    WHERE id = ANY(v_order_ids)
      AND status = 'dispatched';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ordersRecalled', COALESCE(array_length(v_order_ids, 1), 0)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.dispatch_load(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recall_load(uuid) TO authenticated;

COMMENT ON FUNCTION public.dispatch_load IS
  'Atomically dispatch a load: updates delivery run, delivery items, and orders in a single transaction.';
COMMENT ON FUNCTION public.recall_load IS
  'Atomically recall a dispatched load: resets delivery run, items, and orders to pre-dispatch state.';
