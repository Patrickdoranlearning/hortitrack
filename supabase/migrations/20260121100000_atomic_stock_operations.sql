-- Atomic Stock Operations for Picking and QC
-- Addresses risks R1 (non-atomic picking), R2 (non-atomic QC rejection), R3 (void doesn't release allocations)
-- R4 (order item deletion), and adds index for R6 (concurrent picking)

-- =============================================================================
-- 1. ATOMIC PICK ITEM FUNCTION
-- Wraps all pick item operations in a single transaction
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pick_item_atomic(
  p_org_id uuid,
  p_pick_item_id uuid,
  p_picked_qty integer,
  p_picked_batch_id uuid,
  p_user_id uuid,
  p_status text DEFAULT NULL,
  p_substitution_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pick_item record;
  v_order_info record;
  v_effective_batch_id uuid;
  v_final_status text;
  v_new_batch_qty integer;
BEGIN
  -- 1. Get current pick item with related data
  SELECT
    pi.*,
    pl.org_id as pl_org_id,
    pl.id as pick_list_id,
    o.id as order_id,
    o.order_number,
    c.name as customer_name
  INTO v_pick_item
  FROM public.pick_items pi
  JOIN public.pick_lists pl ON pl.id = pi.pick_list_id
  JOIN public.orders o ON o.id = pl.order_id
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE pi.id = p_pick_item_id
    AND pl.org_id = p_org_id
  FOR UPDATE OF pi;  -- Lock the pick item

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pick item not found or access denied');
  END IF;

  -- 2. Determine effective batch ID
  v_effective_batch_id := COALESCE(p_picked_batch_id, v_pick_item.original_batch_id);

  -- 3. Determine final status
  IF p_status = 'short' THEN
    v_final_status := 'short';
  ELSIF p_picked_qty = 0 THEN
    v_final_status := 'skipped';
  ELSIF p_picked_qty < v_pick_item.target_qty THEN
    v_final_status := 'short';
  ELSIF p_picked_batch_id IS NOT NULL AND p_picked_batch_id != v_pick_item.original_batch_id THEN
    v_final_status := 'substituted';
  ELSE
    v_final_status := COALESCE(p_status, 'picked');
  END IF;

  -- 4. Update pick_items
  UPDATE public.pick_items
  SET
    picked_qty = p_picked_qty,
    picked_batch_id = v_effective_batch_id,
    substitution_reason = p_substitution_reason,
    notes = p_notes,
    status = v_final_status,
    picked_at = now(),
    picked_by = p_user_id
  WHERE id = p_pick_item_id;

  -- 5. Deduct from batch inventory (only if quantity > 0 and batch exists)
  IF p_picked_qty > 0 AND v_effective_batch_id IS NOT NULL THEN
    -- Lock and decrement batch
    UPDATE public.batches
    SET
      quantity = quantity - p_picked_qty,
      updated_at = now()
    WHERE id = v_effective_batch_id
      AND org_id = p_org_id
      AND quantity >= p_picked_qty
    RETURNING quantity INTO v_new_batch_qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient quantity or batch not found';
    END IF;

    -- 6. Log batch event
    INSERT INTO public.batch_events (
      org_id,
      batch_id,
      type,
      payload,
      by_user_id,
      at
    ) VALUES (
      p_org_id,
      v_effective_batch_id,
      'PICKED',
      jsonb_build_object(
        'units_picked', p_picked_qty,
        'pick_item_id', p_pick_item_id,
        'pick_list_id', v_pick_item.pick_list_id,
        'order_id', v_pick_item.order_id,
        'order_number', v_pick_item.order_number,
        'customer_name', v_pick_item.customer_name,
        'notes', p_notes,
        'substitution_reason', p_substitution_reason
      ),
      p_user_id,
      now()
    );

    -- 7. Handle batch_allocations
    -- If picking from a different batch than originally allocated (substitution),
    -- we need to release the original allocation and update for new batch
    IF v_pick_item.original_batch_id IS NOT NULL AND v_effective_batch_id != v_pick_item.original_batch_id THEN
      -- Release original allocation (trigger will update reserved_quantity on original batch)
      DELETE FROM public.batch_allocations
      WHERE batch_id = v_pick_item.original_batch_id
        AND order_item_id = v_pick_item.order_item_id
        AND status = 'allocated';

      -- Check if allocation already exists for new batch
      IF EXISTS (
        SELECT 1 FROM public.batch_allocations
        WHERE batch_id = v_effective_batch_id
          AND order_item_id = v_pick_item.order_item_id
      ) THEN
        -- Update existing allocation
        UPDATE public.batch_allocations
        SET
          status = 'picked',
          quantity = p_picked_qty,
          updated_at = now()
        WHERE batch_id = v_effective_batch_id
          AND order_item_id = v_pick_item.order_item_id;
      ELSE
        -- Create new allocation for substituted batch (marked as picked)
        INSERT INTO public.batch_allocations (
          org_id,
          batch_id,
          order_item_id,
          quantity,
          status
        ) VALUES (
          p_org_id,
          v_effective_batch_id,
          v_pick_item.order_item_id,
          p_picked_qty,
          'picked'
        );
      END IF;
    ELSE
      -- Normal case: update existing allocation status
      UPDATE public.batch_allocations
      SET
        status = 'picked',
        updated_at = now()
      WHERE batch_id = v_effective_batch_id
        AND order_item_id = v_pick_item.order_item_id
        AND status = 'allocated';
    END IF;
  END IF;

  -- 8. Log pick list event
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
    CASE WHEN v_final_status = 'substituted' THEN 'item_substituted' ELSE 'item_picked' END,
    format('Picked %s of %s', p_picked_qty, v_pick_item.target_qty),
    jsonb_build_object(
      'pickedQty', p_picked_qty,
      'targetQty', v_pick_item.target_qty,
      'batchId', v_effective_batch_id,
      'substitutionReason', p_substitution_reason
    ),
    p_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', v_final_status,
    'pickedQty', p_picked_qty,
    'batchId', v_effective_batch_id,
    'newBatchQty', v_new_batch_qty
  );
END;
$$;

-- =============================================================================
-- 2. ATOMIC QC REJECTION FUNCTION
-- Restores all picked stock in a single transaction
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reject_pick_list_atomic(
  p_org_id uuid,
  p_pick_list_id uuid,
  p_user_id uuid,
  p_failure_reason text,
  p_failed_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pick_list record;
  v_pick_item record;
  v_items_restored integer := 0;
  v_total_qty_restored integer := 0;
BEGIN
  -- 1. Get and lock pick list
  SELECT pl.*, o.id as order_id
  INTO v_pick_list
  FROM public.pick_lists pl
  JOIN public.orders o ON o.id = pl.order_id
  WHERE pl.id = p_pick_list_id
    AND pl.org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pick list not found or access denied');
  END IF;

  -- 2. Process each picked item with quantity > 0
  FOR v_pick_item IN
    SELECT pi.id, pi.picked_qty, pi.picked_batch_id, pi.order_item_id
    FROM public.pick_items pi
    WHERE pi.pick_list_id = p_pick_list_id
      AND pi.picked_qty > 0
    FOR UPDATE
  LOOP
    IF v_pick_item.picked_batch_id IS NOT NULL AND v_pick_item.picked_qty > 0 THEN
      -- Restore quantity to batch
      UPDATE public.batches
      SET
        quantity = quantity + v_pick_item.picked_qty,
        updated_at = now()
      WHERE id = v_pick_item.picked_batch_id
        AND org_id = p_org_id;

      -- Log restoration event
      INSERT INTO public.batch_events (
        org_id,
        batch_id,
        type,
        payload,
        by_user_id,
        at
      ) VALUES (
        p_org_id,
        v_pick_item.picked_batch_id,
        'QC_REJECTED',
        jsonb_build_object(
          'units_restored', v_pick_item.picked_qty,
          'pick_item_id', v_pick_item.id,
          'pick_list_id', p_pick_list_id,
          'reason', p_failure_reason
        ),
        p_user_id,
        now()
      );

      -- Revert allocation status
      IF v_pick_item.order_item_id IS NOT NULL THEN
        UPDATE public.batch_allocations
        SET
          status = 'allocated',
          updated_at = now()
        WHERE batch_id = v_pick_item.picked_batch_id
          AND order_item_id = v_pick_item.order_item_id
          AND status = 'picked';
      END IF;

      v_items_restored := v_items_restored + 1;
      v_total_qty_restored := v_total_qty_restored + v_pick_item.picked_qty;
    END IF;
  END LOOP;

  -- 3. Reset all pick items back to pending
  UPDATE public.pick_items
  SET
    status = 'pending',
    picked_qty = 0,
    picked_batch_id = NULL,
    picked_by = NULL,
    picked_at = NULL
  WHERE pick_list_id = p_pick_list_id;

  -- 4. Reset pick list status
  UPDATE public.pick_lists
  SET
    status = 'pending',
    started_at = NULL,
    started_by = NULL,
    completed_at = NULL,
    completed_by = NULL
  WHERE id = p_pick_list_id;

  -- 5. Log pick list event
  INSERT INTO public.pick_list_events (
    org_id,
    pick_list_id,
    event_type,
    description,
    metadata,
    created_by
  ) VALUES (
    p_org_id,
    p_pick_list_id,
    'qc_rejected',
    format('Returned for re-pick: %s', p_failure_reason),
    jsonb_build_object(
      'failedItems', p_failed_items,
      'reason', p_failure_reason,
      'itemsRestored', v_items_restored,
      'qtyRestored', v_total_qty_restored
    ),
    p_user_id
  );

  -- 6. Log order event
  INSERT INTO public.order_events (
    org_id,
    order_id,
    event_type,
    description,
    created_by
  ) VALUES (
    p_org_id,
    v_pick_list.order_id,
    'qc_rejected',
    format('QC rejected - returned for re-pick. Reason: %s', p_failure_reason),
    p_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'itemsRestored', v_items_restored,
    'totalQtyRestored', v_total_qty_restored
  );
END;
$$;

-- =============================================================================
-- 3. VOID ORDER FUNCTION (releases allocations)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.void_order_with_allocations(
  p_org_id uuid,
  p_order_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_allocations_released integer;
BEGIN
  -- 1. Get and validate order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or access denied');
  END IF;

  -- Check valid void transitions
  IF v_order.status NOT IN ('draft', 'confirmed', 'picking') THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Cannot void order in %s status. Only draft, confirmed, or picking orders can be voided.', v_order.status));
  END IF;

  -- 2. Delete allocations for unpicked items (triggers will update reserved_quantity)
  -- Only delete allocations that haven't been picked yet
  DELETE FROM public.batch_allocations ba
  USING public.order_items oi
  WHERE ba.order_item_id = oi.id
    AND oi.order_id = p_order_id
    AND ba.status = 'allocated';

  GET DIAGNOSTICS v_allocations_released = ROW_COUNT;

  -- 3. Cancel any pick lists
  UPDATE public.pick_lists
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE order_id = p_order_id
    AND status NOT IN ('completed', 'cancelled');

  -- 4. Void the order
  UPDATE public.orders
  SET
    status = 'void',
    updated_at = now()
  WHERE id = p_order_id;

  -- 5. Log event
  INSERT INTO public.order_events (
    org_id,
    order_id,
    event_type,
    description,
    metadata,
    created_by
  ) VALUES (
    p_org_id,
    p_order_id,
    'status_changed',
    format('Order voided. Released %s allocation(s).', v_allocations_released),
    jsonb_build_object(
      'previousStatus', v_order.status,
      'newStatus', 'void',
      'allocationsReleased', v_allocations_released
    ),
    p_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'allocationsReleased', v_allocations_released
  );
END;
$$;

-- =============================================================================
-- 4. CASCADE DELETE TRIGGER FOR ORDER ITEMS
-- Ensures allocations are deleted when order items are deleted
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_order_item_allocations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete allocations for this order item
  -- The sync_reserved_quantity trigger will handle updating batch.reserved_quantity
  DELETE FROM public.batch_allocations
  WHERE order_item_id = OLD.id;

  RETURN OLD;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_cleanup_order_item_allocations ON public.order_items;

-- Create trigger
CREATE TRIGGER trg_cleanup_order_item_allocations
BEFORE DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_order_item_allocations();

-- =============================================================================
-- 5. ADD COMPOSITE INDEX FOR PICKING OPERATIONS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_batch_allocations_picking
ON public.batch_allocations(batch_id, order_item_id, status);

-- Also add index for order_item_id lookups
CREATE INDEX IF NOT EXISTS idx_batch_allocations_order_item
ON public.batch_allocations(order_item_id);

-- =============================================================================
-- 6. GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.pick_item_atomic(uuid, uuid, integer, uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_pick_list_atomic(uuid, uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_order_with_allocations(uuid, uuid, uuid) TO authenticated;

-- =============================================================================
-- 7. COMMENTS
-- =============================================================================

COMMENT ON FUNCTION public.pick_item_atomic IS
  'Atomically picks an item: updates pick_items, decrements batch quantity, logs events,
   and updates allocation status - all in a single transaction. Prevents inconsistent state
   if any step fails.';

COMMENT ON FUNCTION public.reject_pick_list_atomic IS
  'Atomically rejects a pick list for QC: restores all picked quantities to their batches,
   resets pick items and pick list status, and logs all events - all in a single transaction.';

COMMENT ON FUNCTION public.void_order_with_allocations IS
  'Atomically voids an order: releases all unpicked allocations (restoring reserved_quantity),
   cancels pick lists, and updates order status - all in a single transaction.';
