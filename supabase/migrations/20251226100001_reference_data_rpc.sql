-- ============================================================
-- BULK REFERENCE DATA RPC
-- Returns all reference data in a single call to reduce round trips
-- ============================================================

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
SET search_path = public
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
      FROM plant_varieties v
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
      FROM plant_sizes s
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
      FROM nursery_locations l
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
      FROM suppliers sup
      WHERE sup.org_id = p_org_id
    ) as suppliers;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_reference_data(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_reference_data IS
  'Returns all reference data (varieties, sizes, locations, suppliers) in a single call.
   Reduces network round-trips for pages that need multiple lookup tables.';


-- ============================================================
-- DASHBOARD STATS RPC
-- Returns aggregated dashboard statistics instead of all batches
-- ============================================================

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
SET search_path = public
AS $$
  WITH batch_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status != 'Archived' AND archived_at IS NULL) as active_count,
      SUM(quantity) FILTER (WHERE status != 'Archived' AND archived_at IS NULL) as active_plants,
      COUNT(*) FILTER (WHERE status IN ('Ready for Sale', 'Ready')) as ready_count,
      SUM(quantity) FILTER (WHERE status IN ('Ready for Sale', 'Ready')) as ready_plants,
      COUNT(*) FILTER (WHERE status = 'Archived' OR archived_at IS NOT NULL) as archived_count
    FROM batches
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
      FROM batches b
      LEFT JOIN plant_varieties pv ON pv.id = b.plant_variety_id
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
      FROM batches b
      LEFT JOIN plant_sizes ps ON ps.id = b.size_id
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_stats IS
  'Returns aggregated dashboard statistics without transferring all batch rows.
   Much faster than fetching all batches and aggregating client-side.';



