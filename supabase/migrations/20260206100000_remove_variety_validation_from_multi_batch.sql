-- =============================================================================
-- Remove required_variety_id validation from pick_item_multi_batch
-- =============================================================================
-- Batch allocation is now fully deferred to picking time. The order stage
-- no longer writes required_variety_id, so this check is unnecessary.
-- Product validation (batch belongs to product via product_batches) is kept.
-- Columns are NOT dropped — existing orders retain their values.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pick_item_multi_batch(
  p_org_id uuid,
  p_pick_item_id uuid,
  p_batches jsonb,  -- Array of {batchId: uuid, quantity: integer}
  p_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pick_item record;
  v_batch record;
  v_batch_input record;
  v_total_picked integer := 0;
  v_final_status text;
  v_order_info record;
BEGIN
  -- 1. Validate input
  IF p_batches IS NULL OR jsonb_array_length(p_batches) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No batches provided');
  END IF;

  -- 2. Get and lock the pick item
  SELECT
    pi.*,
    pl.org_id as pl_org_id,
    pl.id as pick_list_id,
    o.id as order_id,
    o.order_number,
    c.name as customer_name,
    oi.product_id
  INTO v_pick_item
  FROM public.pick_items pi
  JOIN public.pick_lists pl ON pl.id = pi.pick_list_id
  JOIN public.orders o ON o.id = pl.order_id
  LEFT JOIN public.customers c ON c.id = o.customer_id
  LEFT JOIN public.order_items oi ON oi.id = pi.order_item_id
  WHERE pi.id = p_pick_item_id
    AND pl.org_id = p_org_id
  FOR UPDATE OF pi;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pick item not found or access denied');
  END IF;

  -- 3. Clear any existing batch picks for this item (in case of re-pick)
  -- First restore quantities to batches
  FOR v_batch_input IN
    SELECT pib.batch_id, pib.quantity
    FROM public.pick_item_batches pib
    WHERE pib.pick_item_id = p_pick_item_id
  LOOP
    -- Restore batch quantity
    UPDATE public.batches
    SET quantity = quantity + v_batch_input.quantity,
        updated_at = now()
    WHERE id = v_batch_input.batch_id;
  END LOOP;

  -- Delete existing batch picks
  DELETE FROM public.pick_item_batches
  WHERE pick_item_id = p_pick_item_id;

  -- Delete existing allocations with 'picked' status for this item
  DELETE FROM public.batch_allocations
  WHERE order_item_id = v_pick_item.order_item_id
    AND status = 'picked';

  -- 4. Process each batch in the input
  FOR v_batch_input IN
    SELECT
      (elem->>'batchId')::uuid as batch_id,
      (elem->>'quantity')::integer as quantity
    FROM jsonb_array_elements(p_batches) as elem
    WHERE (elem->>'quantity')::integer > 0
  LOOP
    -- Validate batch exists and belongs to org
    SELECT b.id, b.quantity, b.org_id, b.plant_variety_id
    INTO v_batch
    FROM public.batches b
    WHERE b.id = v_batch_input.batch_id
      AND b.org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Batch % not found or access denied', v_batch_input.batch_id;
    END IF;

    -- Check sufficient quantity
    IF v_batch.quantity < v_batch_input.quantity THEN
      RAISE EXCEPTION 'Insufficient quantity in batch %. Available: %, Requested: %',
        v_batch_input.batch_id, v_batch.quantity, v_batch_input.quantity;
    END IF;

    -- Validate batch matches product (if product_id exists)
    IF v_pick_item.product_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.product_batches pb
        WHERE pb.product_id = v_pick_item.product_id
          AND pb.batch_id = v_batch_input.batch_id
      ) THEN
        RAISE EXCEPTION 'Batch % does not belong to the ordered product', v_batch_input.batch_id;
      END IF;
    END IF;

    -- NOTE: required_variety_id validation removed — batch allocation
    -- is now fully handled at picking time without variety constraints.

    -- Deduct from batch
    UPDATE public.batches
    SET
      quantity = quantity - v_batch_input.quantity,
      updated_at = now()
    WHERE id = v_batch_input.batch_id;

    -- Insert into junction table
    INSERT INTO public.pick_item_batches (
      org_id,
      pick_item_id,
      batch_id,
      quantity,
      picked_at,
      picked_by
    ) VALUES (
      p_org_id,
      p_pick_item_id,
      v_batch_input.batch_id,
      v_batch_input.quantity,
      now(),
      p_user_id
    );

    -- Create batch allocation with 'picked' status
    INSERT INTO public.batch_allocations (
      org_id,
      batch_id,
      order_item_id,
      quantity,
      status
    ) VALUES (
      p_org_id,
      v_batch_input.batch_id,
      v_pick_item.order_item_id,
      v_batch_input.quantity,
      'picked'
    )
    ON CONFLICT (batch_id, order_item_id)
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      status = 'picked',
      updated_at = now();

    -- Log batch event
    INSERT INTO public.batch_events (
      org_id,
      batch_id,
      type,
      payload,
      by_user_id,
      at
    ) VALUES (
      p_org_id,
      v_batch_input.batch_id,
      'PICKED',
      jsonb_build_object(
        'units_picked', v_batch_input.quantity,
        'pick_item_id', p_pick_item_id,
        'pick_list_id', v_pick_item.pick_list_id,
        'order_id', v_pick_item.order_id,
        'order_number', v_pick_item.order_number,
        'customer_name', v_pick_item.customer_name,
        'multi_batch', true,
        'notes', p_notes
      ),
      p_user_id,
      now()
    );

    v_total_picked := v_total_picked + v_batch_input.quantity;
  END LOOP;

  -- 5. Determine final status
  IF v_total_picked = 0 THEN
    v_final_status := 'skipped';
  ELSIF v_total_picked < v_pick_item.target_qty THEN
    v_final_status := 'short';
  ELSE
    v_final_status := 'picked';
  END IF;

  -- 6. Update pick_items
  -- For multi-batch picks, we set picked_batch_id to NULL
  -- The batchPicks are stored in the junction table
  UPDATE public.pick_items
  SET
    picked_qty = v_total_picked,
    picked_batch_id = NULL,  -- NULL indicates multi-batch pick
    status = v_final_status,
    notes = p_notes,
    picked_at = now(),
    picked_by = p_user_id
  WHERE id = p_pick_item_id;

  -- 7. Log pick list event
  INSERT INTO public.pick_list_events (
    org_id,
    pick_list_id,
    pick_item_id,
    event_type,
    description,
    metadata,
    created_by
  ) VALUES (
    p_org_id,
    v_pick_item.pick_list_id,
    p_pick_item_id,
    'item_multi_batch_picked',
    format('Picked %s of %s from %s batches', v_total_picked, v_pick_item.target_qty, jsonb_array_length(p_batches)),
    jsonb_build_object(
      'pickedQty', v_total_picked,
      'targetQty', v_pick_item.target_qty,
      'batchCount', jsonb_array_length(p_batches),
      'batches', p_batches,
      'notes', p_notes
    ),
    p_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', v_final_status,
    'pickedQty', v_total_picked
  );
END;
$$;
