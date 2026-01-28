-- Update create_order_with_allocations to validate customer batch reservations
-- Prevents allocating batches reserved for other customers

CREATE OR REPLACE FUNCTION public.create_order_with_allocations(
  p_org_id uuid,
  p_customer_id uuid,
  p_order_number text,
  p_lines jsonb, -- Array of: { sku_id, quantity, unit_price, vat_rate, description, allocations: [{batch_id, qty}] }
  p_requested_delivery_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_line jsonb;
  v_order_item_id uuid;
  v_alloc jsonb;
  v_batch_id uuid;
  v_alloc_qty integer;
  v_available integer;
  v_batch_number text;
  v_reserved_for uuid;
  v_result jsonb;
BEGIN
  -- 1) Create the order header
  INSERT INTO public.orders (
    org_id,
    customer_id,
    order_number,
    status,
    requested_delivery_date,
    notes,
    subtotal_ex_vat,
    vat_amount,
    total_inc_vat
  ) VALUES (
    p_org_id,
    p_customer_id,
    p_order_number,
    'confirmed',
    p_requested_delivery_date,
    p_notes,
    0, -- Will be calculated later or by trigger
    0,
    0
  )
  RETURNING id INTO v_order_id;

  -- 2) Process each line item
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    -- Insert order item
    INSERT INTO public.order_items (
      order_id,
      sku_id,
      quantity,
      unit_price_ex_vat,
      vat_rate,
      description
    ) VALUES (
      v_order_id,
      (v_line->>'sku_id')::uuid,
      (v_line->>'quantity')::integer,
      COALESCE((v_line->>'unit_price')::numeric, 0),
      COALESCE((v_line->>'vat_rate')::numeric, 13.5),
      v_line->>'description'
    )
    RETURNING id INTO v_order_item_id;

    -- Process allocations for this line
    FOR v_alloc IN SELECT * FROM jsonb_array_elements(v_line->'allocations')
    LOOP
      v_batch_id := (v_alloc->>'batch_id')::uuid;
      v_alloc_qty := (v_alloc->>'qty')::integer;

      -- Lock the batch row and check available quantity + customer reservation
      SELECT
        (b.quantity - COALESCE(b.reserved_quantity, 0)),
        b.batch_number,
        b.reserved_for_customer_id
      INTO v_available, v_batch_number, v_reserved_for
      FROM public.batches b
      WHERE b.id = v_batch_id
        AND b.org_id = p_org_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch % not found', v_batch_id;
      END IF;

      -- Validate customer reservation: batch must be unreserved OR reserved for this customer
      IF v_reserved_for IS NOT NULL AND v_reserved_for != p_customer_id THEN
        RAISE EXCEPTION 'Batch % is reserved for another customer',
          COALESCE(v_batch_number, v_batch_id::text);
      END IF;

      IF v_available < v_alloc_qty THEN
        RAISE EXCEPTION 'Insufficient stock in batch %. Available: %, Requested: %',
          COALESCE(v_batch_number, v_batch_id::text), v_available, v_alloc_qty;
      END IF;

      -- Create allocation (triggers will update reserved_quantity)
      INSERT INTO public.batch_allocations (
        org_id,
        order_item_id,
        batch_id,
        quantity,
        status
      ) VALUES (
        p_org_id,
        v_order_item_id,
        v_batch_id,
        v_alloc_qty,
        'reserved'
      );
    END LOOP;
  END LOOP;

  -- Return the created order ID
  v_result := jsonb_build_object(
    'order_id', v_order_id,
    'order_number', p_order_number
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_order_with_allocations IS
  'Atomically creates an order with line items and batch allocations.
   Uses row-level locking to prevent race conditions on stock reservation.
   Validates customer batch reservations - reserved batches can only be allocated to their designated customer.';
