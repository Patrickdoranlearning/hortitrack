-- Performance Optimizations Migration
-- Addresses: N+1 queries, in-memory aggregation, missing indexes

-- ============================================================
-- 1. COMPOSITE INDEX FOR SKU LOOKUP
-- Supports bulk SKU resolution by (org_id, variety_id, size_id)
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_skus_org_variety_size
ON public.skus (org_id, plant_variety_id, size_id);

-- ============================================================
-- 2. PLANNING SNAPSHOT AGGREGATION RPC
-- Moves month-bucket aggregation from JS to SQL
-- Reduces payload from MBs of raw batches to KB of summaries
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_planning_buckets(
  p_org_id uuid,
  p_start_date date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_horizon_months int DEFAULT 12
)
RETURNS TABLE (
  bucket_month text,
  bucket_label text,
  physical bigint,
  incoming bigint,
  planned bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_series AS (
    SELECT
      generate_series(
        p_start_date,
        p_start_date + (p_horizon_months - 1) * interval '1 month',
        interval '1 month'
      )::date as month_start
  ),
  batch_aggregates AS (
    SELECT
      date_trunc('month', COALESCE(ready_at, planted_at))::date as batch_month,
      status,
      COALESCE(SUM(quantity), 0) as total_qty
    FROM batches
    WHERE org_id = p_org_id
      AND COALESCE(ready_at, planted_at) >= p_start_date
      AND COALESCE(ready_at, planted_at) < p_start_date + p_horizon_months * interval '1 month'
    GROUP BY 1, 2
  )
  SELECT
    to_char(ms.month_start, 'YYYY-MM') as bucket_month,
    to_char(ms.month_start, 'Mon YYYY') as bucket_label,
    COALESCE(SUM(ba.total_qty) FILTER (WHERE ba.status NOT IN ('Incoming', 'Planned')), 0)::bigint as physical,
    COALESCE(SUM(ba.total_qty) FILTER (WHERE ba.status = 'Incoming'), 0)::bigint as incoming,
    COALESCE(SUM(ba.total_qty) FILTER (WHERE ba.status = 'Planned'), 0)::bigint as planned
  FROM month_series ms
  LEFT JOIN batch_aggregates ba ON date_trunc('month', ba.batch_month) = ms.month_start
  GROUP BY ms.month_start
  ORDER BY ms.month_start;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_planning_buckets(uuid, date, int) TO authenticated;

-- ============================================================
-- 3. PRODUCT AVAILABILITY AGGREGATION RPC
-- Replaces in-memory Map aggregation with SQL grouping
-- Returns summarized availability per variety/size combo
-- ============================================================
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
SET search_path = public
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
  FROM batches b
  INNER JOIN plant_varieties pv ON pv.id = b.plant_variety_id
  INNER JOIN plant_sizes ps ON ps.id = b.size_id
  INNER JOIN attribute_options ao ON ao.id = b.status_id
  WHERE b.org_id = p_org_id
    AND ao.behavior = 'available'
    AND ao.display_label IN ('Ready for Sale', 'Looking Good')
    AND b.quantity > 0
    AND (b.quantity - COALESCE(b.reserved_quantity, 0)) > 0
    AND (b.hidden IS NULL OR b.hidden = false)
  GROUP BY pv.name, b.plant_variety_id, ps.name, b.size_id
  ORDER BY pv.name, ps.name;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_product_availability(uuid) TO authenticated;

-- ============================================================
-- 4. SALEABLE BATCHES WITH AVAILABILITY INFO
-- Optimized version that filters in SQL instead of JS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_saleable_batches(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  batch_number text,
  plant_variety text,
  plant_variety_id uuid,
  size text,
  size_id uuid,
  status text,
  qc_status text,
  quantity int,
  reserved_quantity int,
  available_quantity int,
  grade text,
  location text,
  planting_date timestamptz,
  created_at timestamptz,
  hidden boolean,
  category text,
  grower_photo_url text,
  sales_photo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.batch_number,
    pv.name as plant_variety,
    b.plant_variety_id,
    ps.name as size,
    b.size_id,
    ao.display_label as status,
    b.qc_status,
    b.quantity,
    COALESCE(b.reserved_quantity, 0) as reserved_quantity,
    GREATEST(0, b.quantity - COALESCE(b.reserved_quantity, 0)) as available_quantity,
    b.grade,
    nl.name as location,
    b.planting_date,
    b.created_at,
    COALESCE(b.hidden, false) as hidden,
    b.category,
    b.grower_photo_url,
    b.sales_photo_url
  FROM batches b
  INNER JOIN plant_varieties pv ON pv.id = b.plant_variety_id
  INNER JOIN plant_sizes ps ON ps.id = b.size_id
  INNER JOIN attribute_options ao ON ao.id = b.status_id
  LEFT JOIN nursery_locations nl ON nl.id = b.location_id
  WHERE b.org_id = p_org_id
    AND ao.behavior = 'available'
    AND ao.display_label IN ('Ready for Sale', 'Looking Good')
    AND b.quantity > 0
    AND (b.quantity - COALESCE(b.reserved_quantity, 0)) > 0
    AND (b.hidden IS NULL OR b.hidden = false)
    AND (b.qc_status IS NULL OR b.qc_status NOT IN ('Rejected', 'Quarantined'))
  ORDER BY b.planting_date ASC NULLS LAST, b.created_at ASC, b.grade ASC NULLS LAST;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_saleable_batches(uuid) TO authenticated;
