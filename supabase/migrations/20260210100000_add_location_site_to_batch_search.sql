-- Add nursery_site to v_batch_search so batch cards can show which site a location belongs to
-- This fixes ambiguity when multiple sites have locations with the same name (e.g. "Tunnel 1")

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
  l.nursery_site as location_site,
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

COMMENT ON VIEW public.v_batch_search IS 'Lookup view combining batches with reference tables for faster UI filtering. Includes inline distribution data and location site.';

GRANT SELECT ON public.v_batch_search TO authenticated;
