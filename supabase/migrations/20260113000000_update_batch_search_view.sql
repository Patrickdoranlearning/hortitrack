-- Update v_batch_search to include reserved_quantity, log_history, and distribution
-- Note: This migration recreates the view with distribution data inline

-- First ensure the distribution function exists
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

  -- Get sales allocations (allocated/reserved status = reserved for sales orders)
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_allocated_sales
  FROM batch_allocations
  WHERE batch_id = p_batch_id AND status IN ('allocated', 'reserved');

  -- Get sold (picked status)
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_sold
  FROM batch_allocations
  WHERE batch_id = p_batch_id AND status = 'picked';

  -- Get dumped/loss from batch_events
  -- Handle both proper JSONB objects and double-encoded JSON strings
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

  -- Get transplanted out from events
  -- Handle both proper JSONB objects and double-encoded JSON strings
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

DROP VIEW IF EXISTS public.v_batch_search CASCADE;
CREATE VIEW public.v_batch_search
WITH (security_invoker = true)
AS
SELECT
  b.id,
  b.org_id,
  b.batch_number,
  b.status,
  b.phase,
  b.quantity,
  b.reserved_quantity,
  b.initial_quantity,
  b.log_history,
  b.ready_at,
  b.updated_at,
  b.created_at,
  b.location_id,
  l.name as location_name,
  b.size_id,
  sz.name as size_name,
  b.supplier_id,
  sup.name as supplier_name,
  b.plant_variety_id,
  v.name as variety_name,
  v.family,
  v.category,
  b.status_id,
  ao.behavior,
  b.saleable_quantity,
  b.sales_photo_url,
  b.grower_photo_url,
  -- Add distribution data inline (eliminates need for separate API calls)
  get_batch_distribution(b.id) AS distribution
FROM public.batches b
LEFT JOIN public.nursery_locations l ON l.id = b.location_id
LEFT JOIN public.plant_sizes sz ON sz.id = b.size_id
LEFT JOIN public.suppliers sup ON sup.id = b.supplier_id
LEFT JOIN public.plant_varieties v ON v.id = b.plant_variety_id
LEFT JOIN public.attribute_options ao ON ao.id = b.status_id;

COMMENT ON VIEW public.v_batch_search IS 'Lookup view combining batches with reference tables for faster UI filtering. Includes inline distribution data.';

GRANT SELECT ON public.v_batch_search TO authenticated;
