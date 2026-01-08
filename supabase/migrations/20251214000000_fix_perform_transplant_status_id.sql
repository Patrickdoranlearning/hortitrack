-- Fix perform_transplant function to include status_id
-- The batches table now requires status_id (not null constraint)

CREATE OR REPLACE FUNCTION public.perform_transplant(
  p_org_id uuid,
  p_parent_batch_id uuid,
  p_size_id uuid,
  p_location_id uuid,
  p_containers integer,
  p_user_id uuid,
  p_planted_at date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_archive_parent_if_empty boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_batch record;
  v_target_size record;
  v_child_units integer;
  v_child_phase production_phase;
  v_child_batch_number text;
  v_child_id uuid;
  v_parent_new_qty integer;
  v_request_id uuid := gen_random_uuid();
  v_internal_supplier_id uuid;
  v_org record;
  v_proportion numeric;
  v_growing_status_id uuid;
  v_archived_status_id uuid;
BEGIN
  -- Validate inputs
  IF p_containers <= 0 THEN
    RAISE EXCEPTION 'Containers must be > 0';
  END IF;

  -- Fetch and lock parent batch
  SELECT * INTO v_parent_batch
  FROM public.batches
  WHERE id = p_parent_batch_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent batch not found or access denied';
  END IF;

  -- Get status IDs for Growing and Archived
  SELECT id INTO v_growing_status_id
  FROM public.attribute_options
  WHERE org_id = p_org_id
    AND attribute_key = 'production_status'
    AND (system_code = 'Growing' OR display_label = 'Growing')
  LIMIT 1;

  SELECT id INTO v_archived_status_id
  FROM public.attribute_options
  WHERE org_id = p_org_id
    AND attribute_key = 'production_status'
    AND (system_code = 'Archived' OR display_label = 'Archived')
  LIMIT 1;

  -- If status IDs not found, create them
  IF v_growing_status_id IS NULL THEN
    INSERT INTO public.attribute_options (org_id, attribute_key, system_code, display_label, sort_order)
    VALUES (p_org_id, 'production_status', 'Growing', 'Growing', 1)
    RETURNING id INTO v_growing_status_id;
  END IF;

  IF v_archived_status_id IS NULL THEN
    INSERT INTO public.attribute_options (org_id, attribute_key, system_code, display_label, sort_order)
    VALUES (p_org_id, 'production_status', 'Archived', 'Archived', 99)
    RETURNING id INTO v_archived_status_id;
  END IF;

  -- Fetch parent batch size to calculate units being taken
  DECLARE
    v_parent_size record;
  BEGIN
    SELECT * INTO v_parent_size
    FROM public.plant_sizes
    WHERE id = v_parent_batch.size_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent batch size not found';
    END IF;

    -- Calculate units being taken from parent: containers * parent's cell_multiple
    -- This is the actual number of plants being moved
    v_child_units := p_containers * COALESCE(v_parent_size.cell_multiple, 1);
  END;

  -- Fetch target size to determine child phase
  SELECT * INTO v_target_size
  FROM public.plant_sizes
  WHERE id = p_size_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target size not found';
  END IF;

  -- Check parent has enough quantity
  IF v_child_units > COALESCE(v_parent_batch.quantity, 0) THEN
    RAISE EXCEPTION 'Insufficient quantity in parent batch. Available: %, Required: %',
      COALESCE(v_parent_batch.quantity, 0), v_child_units;
  END IF;

  -- Determine child phase based on container type
  IF v_target_size.container_type = 'pot' OR COALESCE(v_target_size.cell_multiple, 0) <= 1 THEN
    v_child_phase := 'potted';
  ELSIF COALESCE(v_target_size.cell_multiple, 0) >= 3 THEN
    v_child_phase := 'plug';
  ELSE
    v_child_phase := 'propagation';
  END IF;

  -- Get internal supplier ID
  SELECT id INTO v_internal_supplier_id
  FROM public.suppliers
  WHERE org_id = p_org_id
    AND is_internal = true
  LIMIT 1;

  IF v_internal_supplier_id IS NULL THEN
    -- Create internal supplier if it doesn't exist
    INSERT INTO public.suppliers (org_id, name, is_internal)
    VALUES (p_org_id, 'Internal', true)
    RETURNING id INTO v_internal_supplier_id;
  END IF;

  -- Generate child batch number based on phase using counter system
  DECLARE
    v_phase_counter integer;
    v_year_week text;
    v_counter_key text;
    v_seq bigint;
    v_year integer;
    v_jan1 date;
    v_days integer;
    v_week integer;
  BEGIN
    IF v_child_phase = 'propagation' THEN
      v_phase_counter := 1;
    ELSIF v_child_phase = 'plug' THEN
      v_phase_counter := 2;
    ELSE
      v_phase_counter := 3;
    END IF;

    -- Calculate year-week (YYWW format) - matching nextBatchNumber logic
    v_year := EXTRACT(YEAR FROM CURRENT_DATE);
    v_jan1 := DATE_TRUNC('year', CURRENT_DATE)::date;
    v_days := EXTRACT(DAY FROM CURRENT_DATE - v_jan1)::integer;
    v_week := CEIL((v_days + EXTRACT(DOW FROM v_jan1)::integer + 1) / 7.0)::integer;
    v_year_week := LPAD((v_year % 100)::text, 2, '0') || LPAD(v_week::text, 2, '0');

    v_counter_key := 'batch-' || v_phase_counter || '-' || v_year_week;

    -- Use increment_counter function (must exist)
    SELECT public.increment_counter(p_org_id := p_org_id, p_key := v_counter_key) INTO v_seq;

    -- Format: {phase}-{yyww}-{seq} (matching nextBatchNumber format)
    v_child_batch_number := v_phase_counter || '-' || v_year_week || '-' || LPAD(v_seq::text, 5, '0');
  END;

  -- Decrement parent batch quantity atomically
  SELECT public.decrement_batch_quantity(p_org_id, p_parent_batch_id, v_child_units)
  INTO v_parent_new_qty;

  -- Create child batch (now with status_id)
  INSERT INTO public.batches (
    org_id,
    batch_number,
    phase,
    plant_variety_id,
    size_id,
    location_id,
    status,
    status_id,
    supplier_id,
    quantity,
    initial_quantity,
    planted_at,
    unit,
    parent_batch_id
  ) VALUES (
    p_org_id,
    v_child_batch_number,
    v_child_phase,
    v_parent_batch.plant_variety_id,
    p_size_id,
    p_location_id,
    'Growing',
    v_growing_status_id,
    v_internal_supplier_id,
    v_child_units,
    v_child_units,
    COALESCE(p_planted_at, CURRENT_DATE),
    'plants',
    p_parent_batch_id
  )
  RETURNING id INTO v_child_id;

  -- Calculate proportion for ancestry
  v_proportion := CASE
    WHEN COALESCE(v_parent_batch.quantity + v_child_units, 0) > 0 THEN
      v_child_units::numeric / (v_parent_batch.quantity + v_child_units)::numeric
    ELSE 1.0
  END;

  -- Link ancestry
  INSERT INTO public.batch_ancestry (
    org_id,
    parent_batch_id,
    child_batch_id,
    proportion
  ) VALUES (
    p_org_id,
    p_parent_batch_id,
    v_child_id,
    v_proportion
  );

  -- Create events
  INSERT INTO public.batch_events (
    batch_id,
    org_id,
    type,
    by_user_id,
    payload,
    request_id
  ) VALUES
  (
    p_parent_batch_id,
    p_org_id,
    'TRANSPLANT_OUT',
    p_user_id,
    jsonb_build_object(
      'to_batch_id', v_child_id,
      'to_batch_number', v_child_batch_number,
      'units_moved', v_child_units,
      'containers', p_containers,
      'note', p_notes
    ),
    v_request_id
  ),
  (
    v_child_id,
    p_org_id,
    'TRANSPLANT_IN',
    p_user_id,
    jsonb_build_object(
      'from_batch_id', p_parent_batch_id,
      'from_batch_number', v_parent_batch.batch_number,
      'units_received', v_child_units,
      'containers', p_containers,
      'note', p_notes
    ),
    v_request_id
  );

  -- Archive parent if empty and requested (now with status_id)
  IF v_parent_new_qty = 0 AND p_archive_parent_if_empty THEN
    UPDATE public.batches
    SET status = 'Archived',
        status_id = v_archived_status_id,
        archived_at = now()
    WHERE id = p_parent_batch_id
      AND org_id = p_org_id;

    INSERT INTO public.batch_events (
      batch_id,
      org_id,
      type,
      by_user_id,
      payload,
      request_id
    ) VALUES (
      p_parent_batch_id,
      p_org_id,
      'ARCHIVE',
      p_user_id,
      jsonb_build_object('reason', 'Zero quantity after transplant'),
      v_request_id
    );
  END IF;

  -- Get org defaults for passport
  SELECT producer_code, country_code INTO v_org
  FROM public.organizations
  WHERE id = p_org_id;

  -- Create passport for child batch
  INSERT INTO public.batch_passports (
    batch_id,
    org_id,
    passport_type,
    operator_reg_no,
    traceability_code,
    origin_country,
    created_by_user_id
  ) VALUES (
    v_child_id,
    p_org_id,
    'internal',
    COALESCE(v_org.producer_code, 'UNKNOWN'),
    v_child_batch_number,
    COALESCE(v_org.country_code, 'IE'),
    p_user_id
  );

  -- Return result
  RETURN jsonb_build_object(
    'request_id', v_request_id,
    'child_batch', jsonb_build_object(
      'id', v_child_id,
      'batch_number', v_child_batch_number,
      'quantity', v_child_units,
      'phase', v_child_phase
    ),
    'parent_new_quantity', v_parent_new_qty
  );
END;
$$;

COMMENT ON FUNCTION public.perform_transplant IS
  'Atomically performs a batch transplant: creates child batch with status_id, decrements parent quantity,
   links ancestry, logs events, and creates passport. All operations are transactional.';
