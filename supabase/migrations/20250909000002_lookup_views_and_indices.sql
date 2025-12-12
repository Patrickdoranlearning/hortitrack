-- 1) Views to normalize case & expose slim lookup payloads

CREATE OR REPLACE VIEW public.lookup_varieties AS
SELECT
  id,
  name,
  family,
  genus,
  species,
  ("Category")::text AS category,  -- normalize the Casing issue
  created_at,
  updated_at
FROM public.plant_varieties;

CREATE OR REPLACE VIEW public.lookup_sizes AS
SELECT
  id, name, container_type, cell_multiple
FROM public.plant_sizes;

CREATE OR REPLACE VIEW public.lookup_locations AS
SELECT
  id, org_id, name, nursery_site, covered
FROM public.nursery_locations;

CREATE OR REPLACE VIEW public.lookup_suppliers AS
SELECT
  id, org_id, name, producer_code, country_code
FROM public.suppliers;

-- 2) Friendly partial indexes for LIKE searches / ordering
CREATE INDEX IF NOT EXISTS idx_varieties_name ON public.plant_varieties (name);
CREATE INDEX IF NOT EXISTS idx_locations_name ON public.nursery_locations (name);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers (name);

-- Optional: RLS is already present for base tables; views inherit.
