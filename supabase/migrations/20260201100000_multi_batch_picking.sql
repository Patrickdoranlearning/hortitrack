-- Multi-Batch Picking Implementation
-- Allows picking a single order line from multiple batches
-- Addresses the gap where no single batch has enough stock for an order line

-- =============================================================================
-- 1. CREATE JUNCTION TABLE: pick_item_batches
-- Stores individual batch picks for multi-batch scenarios
-- =============================================================================

CREATE TABLE public.pick_item_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  pick_item_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  picked_at timestamptz NOT NULL DEFAULT now(),
  picked_by uuid,

  CONSTRAINT pick_item_batches_pkey PRIMARY KEY (id),
  CONSTRAINT pick_item_batches_org_fkey FOREIGN KEY (org_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT pick_item_batches_pick_item_fkey FOREIGN KEY (pick_item_id)
    REFERENCES public.pick_items(id) ON DELETE CASCADE,
  CONSTRAINT pick_item_batches_batch_fkey FOREIGN KEY (batch_id)
    REFERENCES public.batches(id) ON DELETE RESTRICT,
  CONSTRAINT pick_item_batches_user_fkey FOREIGN KEY (picked_by)
    REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Prevent duplicate batch entries per pick item
  CONSTRAINT pick_item_batches_unique UNIQUE (pick_item_id, batch_id)
);

-- Indexes for common queries
CREATE INDEX idx_pick_item_batches_pick_item ON public.pick_item_batches(pick_item_id);
CREATE INDEX idx_pick_item_batches_batch ON public.pick_item_batches(batch_id);
CREATE INDEX idx_pick_item_batches_org ON public.pick_item_batches(org_id);

-- =============================================================================
-- 2. RLS POLICIES FOR pick_item_batches
-- =============================================================================

ALTER TABLE public.pick_item_batches ENABLE ROW LEVEL SECURITY;

-- Combined policy for SELECT/INSERT/UPDATE/DELETE based on org membership
CREATE POLICY pick_item_batches_org_policy ON public.pick_item_batches
  FOR ALL
  USING (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. HELPER FUNCTION: restore_batch_quantity
-- Restores quantity to a batch (for undo operations)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restore_batch_quantity(
  p_batch_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.batches
  SET
    quantity = quantity + p_quantity,
    updated_at = now()
  WHERE id = p_batch_id;
END;
$$;

-- =============================================================================
-- 4. MAIN RPC: pick_item_multi_batch
-- Atomically picks from multiple batches for a single order line
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
    oi.product_id,
    oi.required_variety_id
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

    -- Validate batch matches required variety (if specified)
    IF v_pick_item.required_variety_id IS NOT NULL THEN
      IF v_batch.plant_variety_id != v_pick_item.required_variety_id THEN
        RAISE EXCEPTION 'Batch % has wrong variety for this line', v_batch_input.batch_id;
      END IF;
    END IF;

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

-- =============================================================================
-- 5. UPDATE reject_pick_list_atomic TO HANDLE MULTI-BATCH PICKS
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
  v_batch_pick record;
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

  -- 2. Process each picked item
  FOR v_pick_item IN
    SELECT pi.id, pi.picked_qty, pi.picked_batch_id, pi.order_item_id
    FROM public.pick_items pi
    WHERE pi.pick_list_id = p_pick_list_id
      AND pi.picked_qty > 0
    FOR UPDATE
  LOOP
    -- Handle multi-batch picks (picked_batch_id IS NULL means multi-batch)
    IF v_pick_item.picked_batch_id IS NULL THEN
      -- Restore from junction table
      FOR v_batch_pick IN
        SELECT pib.batch_id, pib.quantity
        FROM public.pick_item_batches pib
        WHERE pib.pick_item_id = v_pick_item.id
      LOOP
        -- Restore quantity to batch
        UPDATE public.batches
        SET
          quantity = quantity + v_batch_pick.quantity,
          updated_at = now()
        WHERE id = v_batch_pick.batch_id
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
          v_batch_pick.batch_id,
          'QC_REJECTED',
          jsonb_build_object(
            'units_restored', v_batch_pick.quantity,
            'pick_item_id', v_pick_item.id,
            'pick_list_id', p_pick_list_id,
            'reason', p_failure_reason,
            'multi_batch', true
          ),
          p_user_id,
          now()
        );

        v_total_qty_restored := v_total_qty_restored + v_batch_pick.quantity;
      END LOOP;

      -- Delete batch picks
      DELETE FROM public.pick_item_batches
      WHERE pick_item_id = v_pick_item.id;

      v_items_restored := v_items_restored + 1;

    -- Handle single-batch picks (original behavior)
    ELSIF v_pick_item.picked_batch_id IS NOT NULL AND v_pick_item.picked_qty > 0 THEN
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

      v_items_restored := v_items_restored + 1;
      v_total_qty_restored := v_total_qty_restored + v_pick_item.picked_qty;
    END IF;

    -- Revert allocation status for all batches
    IF v_pick_item.order_item_id IS NOT NULL THEN
      UPDATE public.batch_allocations
      SET
        status = 'allocated',
        updated_at = now()
      WHERE order_item_id = v_pick_item.order_item_id
        AND status = 'picked';
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
-- 6. GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pick_item_batches TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_batch_quantity(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pick_item_multi_batch(uuid, uuid, jsonb, uuid, text) TO authenticated;

-- =============================================================================
-- 7. COMMENTS
-- =============================================================================

COMMENT ON TABLE public.pick_item_batches IS
  'Junction table storing individual batch picks for multi-batch picking scenarios.
   When a pick_item has picked_batch_id = NULL and picked_qty > 0, the actual batch
   breakdown is stored in this table.';

COMMENT ON FUNCTION public.pick_item_multi_batch IS
  'Atomically picks from multiple batches for a single order line.
   Validates all batches, deducts quantities, creates junction table entries,
   logs all events, and updates pick_items - all in a single transaction.
   If any batch fails validation, the entire operation is rolled back.';

COMMENT ON FUNCTION public.restore_batch_quantity IS
  'Helper function to restore quantity to a batch (e.g., for undo operations).
   Used by the application layer when removing individual batch picks.';
