-- Update batch search view to include status behavior from attribute_options
create or replace view public.v_batch_search as
select
  b.id,
  b.org_id,
  b.batch_number,
  b.status,
  b.phase,
  b.quantity,
  b.initial_quantity,
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
  b.grower_photo_url
from public.batches b
left join public.nursery_locations l on l.id = b.location_id
left join public.plant_sizes sz on sz.id = b.size_id
left join public.suppliers sup on sup.id = b.supplier_id
left join public.plant_varieties v on v.id = b.plant_variety_id
left join public.attribute_options ao on ao.id = b.status_id;

comment on view public.v_batch_search is 'Lookup view combining batches with reference tables for faster UI filtering';
