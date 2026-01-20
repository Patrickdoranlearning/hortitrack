-- Fix functions that reference plant_varieties without public. prefix
-- The search_path was set to '' for security, but some functions use unqualified table names
-- This caused "relation plant_varieties does not exist" errors

-- Drop functions first to allow changing return types
DROP FUNCTION IF EXISTS public.search_batches_for_scout(uuid, text, int);
DROP FUNCTION IF EXISTS public.get_reference_data(uuid);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);
DROP FUNCTION IF EXISTS public.get_product_availability(uuid);
DROP FUNCTION IF EXISTS public.get_saleable_batches(uuid);

-- Fix search_batches_for_scout - uses unqualified plant_varieties
CREATE OR REPLACE FUNCTION public.search_batches_for_scout(
  p_org_id uuid,
  p_search text,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  batch_number text,
  location_id uuid,
  variety_name text,
  variety_family text,
  location_name text
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT DISTINCT ON (b.id)
    b.id,
    b.batch_number,
    b.location_id,
    pv.name as variety_name,
    pv.family as variety_family,
    nl.name as location_name
  FROM public.batches b
  LEFT JOIN public.plant_varieties pv ON b.plant_variety_id = pv.id
  LEFT JOIN public.nursery_locations nl ON b.location_id = nl.id
  WHERE b.org_id = p_org_id
    AND b.status NOT IN ('Archived', 'Shipped')
    AND (
      b.batch_number ILIKE '%' || p_search || '%'
      OR pv.name ILIKE '%' || p_search || '%'
      OR pv.family ILIKE '%' || p_search || '%'
    )
  ORDER BY b.id, b.created_at DESC
  LIMIT p_limit;
$$;

-- Fix get_reference_data - uses unqualified plant_varieties and plant_sizes
CREATE OR REPLACE FUNCTION public.get_reference_data(p_org_id uuid)
RETURNS TABLE (
  varieties jsonb,
  sizes jsonb,
  locations jsonb,
  suppliers jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    -- Varieties (global, not org-scoped)
    (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'name', v.name,
          'family', v.family,
          'genus', v.genus,
          'species', v.species,
          'category', v.category
        ) ORDER BY v.name
      ), '[]'::jsonb)
      FROM public.plant_varieties v
    ) as varieties,

    -- Sizes (global, not org-scoped)
    (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'container_type', s.container_type,
          'cell_multiple', s.cell_multiple
        ) ORDER BY s.name
      ), '[]'::jsonb)
      FROM public.plant_sizes s
    ) as sizes,

    -- Locations (org-scoped)
    (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'name', l.name,
          'covered', l.covered,
          'area', l.area,
          'nursery_site', l.nursery_site
        ) ORDER BY l.name
      ), '[]'::jsonb)
      FROM public.nursery_locations l
      WHERE l.org_id = p_org_id
    ) as locations,

    -- Suppliers (org-scoped)
    (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', sup.id,
          'name', sup.name,
          'producer_code', sup.producer_code,
          'country_code', sup.country_code
        ) ORDER BY sup.name
      ), '[]'::jsonb)
      FROM public.suppliers sup
      WHERE sup.org_id = p_org_id
    ) as suppliers;
$$;

-- Fix get_dashboard_stats - uses unqualified plant_varieties and plant_sizes
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_org_id uuid)
RETURNS TABLE (
  total_plants bigint,
  active_batches bigint,
  ready_for_sale_batches bigint,
  ready_for_sale_plants bigint,
  archived_batches bigint,
  family_distribution jsonb,
  size_distribution jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH batch_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status != 'Archived' AND archived_at IS NULL) as active_count,
      SUM(quantity) FILTER (WHERE status != 'Archived' AND archived_at IS NULL) as active_plants,
      COUNT(*) FILTER (WHERE status IN ('Ready for Sale', 'Ready')) as ready_count,
      SUM(quantity) FILTER (WHERE status IN ('Ready for Sale', 'Ready')) as ready_plants,
      COUNT(*) FILTER (WHERE status = 'Archived' OR archived_at IS NOT NULL) as archived_count
    FROM public.batches
    WHERE org_id = p_org_id
  ),
  family_stats AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('name', family, 'value', total)
      ORDER BY total DESC
    ), '[]'::jsonb) as distribution
    FROM (
      SELECT
        COALESCE(pv.family, 'Unknown') as family,
        SUM(b.quantity)::bigint as total
      FROM public.batches b
      LEFT JOIN public.plant_varieties pv ON pv.id = b.plant_variety_id
      WHERE b.org_id = p_org_id
        AND b.status != 'Archived'
        AND b.archived_at IS NULL
        AND b.quantity > 0
      GROUP BY COALESCE(pv.family, 'Unknown')
    ) sub
  ),
  size_stats AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('name', size_name, 'value', total)
      ORDER BY total DESC
    ), '[]'::jsonb) as distribution
    FROM (
      SELECT
        COALESCE(ps.name, 'Unknown') as size_name,
        SUM(b.quantity)::bigint as total
      FROM public.batches b
      LEFT JOIN public.plant_sizes ps ON ps.id = b.size_id
      WHERE b.org_id = p_org_id
        AND b.status != 'Archived'
        AND b.archived_at IS NULL
        AND b.quantity > 0
      GROUP BY COALESCE(ps.name, 'Unknown')
    ) sub
  )
  SELECT
    COALESCE(bs.active_plants, 0)::bigint as total_plants,
    COALESCE(bs.active_count, 0)::bigint as active_batches,
    COALESCE(bs.ready_count, 0)::bigint as ready_for_sale_batches,
    COALESCE(bs.ready_plants, 0)::bigint as ready_for_sale_plants,
    COALESCE(bs.archived_count, 0)::bigint as archived_batches,
    fs.distribution as family_distribution,
    ss.distribution as size_distribution
  FROM batch_stats bs, family_stats fs, size_stats ss;
$$;

-- Fix get_product_availability - uses unqualified plant_varieties and plant_sizes
CREATE OR REPLACE FUNCTION public.get_product_availability(p_org_id uuid)
RETURNS TABLE (
  product_key text,
  plant_variety text,
  plant_variety_id uuid,
  size text,
  size_id uuid,
  total_quantity bigint,
  reserved_quantity bigint,
  available_quantity bigint,
  batch_count bigint,
  sample_image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    CONCAT(pv.name, '-', ps.name) as product_key,
    pv.name as plant_variety,
    b.plant_variety_id,
    ps.name as size,
    b.size_id,
    COALESCE(SUM(b.quantity), 0)::bigint as total_quantity,
    COALESCE(SUM(b.reserved_quantity), 0)::bigint as reserved_quantity,
    GREATEST(0, COALESCE(SUM(b.quantity), 0) - COALESCE(SUM(b.reserved_quantity), 0))::bigint as available_quantity,
    COUNT(b.id)::bigint as batch_count,
    MIN(COALESCE(b.sales_photo_url, b.grower_photo_url)) as sample_image_url
  FROM public.batches b
  INNER JOIN public.plant_varieties pv ON pv.id = b.plant_variety_id
  INNER JOIN public.plant_sizes ps ON ps.id = b.size_id
  INNER JOIN public.attribute_options ao ON ao.id = b.status_id
  WHERE b.org_id = p_org_id
    AND ao.behavior = 'available'
    AND ao.display_label IN ('Ready for Sale', 'Looking Good')
    AND b.quantity > 0
    AND (b.quantity - COALESCE(b.reserved_quantity, 0)) > 0
    AND (b.hidden IS NULL OR b.hidden = false)
  GROUP BY pv.name, b.plant_variety_id, ps.name, b.size_id
  ORDER BY pv.name, ps.name;
$$;

-- Fix get_saleable_batches - uses unqualified plant_varieties and plant_sizes
-- Adjusted to match actual batches table schema
CREATE OR REPLACE FUNCTION public.get_saleable_batches(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  batch_number text,
  plant_variety text,
  plant_variety_id uuid,
  size text,
  size_id uuid,
  status text,
  growing_status text,
  quantity int,
  reserved_quantity int,
  available_quantity int,
  sales_status text,
  location text,
  planted_at timestamptz,
  created_at timestamptz,
  hidden boolean,
  grower_photo_url text,
  sales_photo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    b.id,
    b.batch_number,
    pv.name as plant_variety,
    b.plant_variety_id,
    ps.name as size,
    b.size_id,
    ao.display_label as status,
    b.growing_status,
    b.quantity,
    COALESCE(b.reserved_quantity, 0) as reserved_quantity,
    GREATEST(0, b.quantity - COALESCE(b.reserved_quantity, 0)) as available_quantity,
    b.sales_status,
    nl.name as location,
    b.planted_at,
    b.created_at,
    COALESCE(b.hidden, false) as hidden,
    b.grower_photo_url,
    b.sales_photo_url
  FROM public.batches b
  INNER JOIN public.plant_varieties pv ON pv.id = b.plant_variety_id
  INNER JOIN public.plant_sizes ps ON ps.id = b.size_id
  INNER JOIN public.attribute_options ao ON ao.id = b.status_id
  LEFT JOIN public.nursery_locations nl ON nl.id = b.location_id
  WHERE b.org_id = p_org_id
    AND ao.behavior = 'available'
    AND ao.display_label IN ('Ready for Sale', 'Looking Good')
    AND b.quantity > 0
    AND (b.quantity - COALESCE(b.reserved_quantity, 0)) > 0
    AND (b.hidden IS NULL OR b.hidden = false)
  ORDER BY b.batch_number;
$$;

-- Drop all triggers that depend on auto_link_batch_to_products function
-- Using static DROP statements to ensure all variants are handled
DROP TRIGGER IF EXISTS trg_auto_link_batch ON public.batches;
DROP TRIGGER IF EXISTS trg_auto_link_batch_update ON public.batches;
DROP TRIGGER IF EXISTS trg_auto_link_batch_to_products ON public.batches;
DROP TRIGGER IF EXISTS auto_link_batch_to_products ON public.batches;
DROP FUNCTION IF EXISTS public.auto_link_batch_to_products();

-- Drop batch_logs_sync triggers (on both tables) and function
DROP TRIGGER IF EXISTS trg_batch_logs_sync ON public.batches;
DROP TRIGGER IF EXISTS batch_logs_sync ON public.batches;
DROP TRIGGER IF EXISTS trg_batch_logs_sync_aiud ON public.batch_logs;
DROP FUNCTION IF EXISTS public.trg_batch_logs_sync();
