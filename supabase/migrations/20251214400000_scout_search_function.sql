-- Fast batch search function for Scout Mode
-- This eliminates multiple round-trips by doing the search in a single query

CREATE OR REPLACE FUNCTION search_batches_for_scout(
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
AS $$
  SELECT DISTINCT ON (b.id)
    b.id,
    b.batch_number,
    b.location_id,
    pv.name as variety_name,
    pv.family as variety_family,
    nl.name as location_name
  FROM batches b
  LEFT JOIN plant_varieties pv ON b.plant_variety_id = pv.id
  LEFT JOIN nursery_locations nl ON b.location_id = nl.id
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION search_batches_for_scout(uuid, text, int) TO authenticated;

-- Enable pg_trgm extension for fast text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add indexes for faster text search if they don't exist
CREATE INDEX IF NOT EXISTS idx_batches_batch_number_trgm 
  ON batches USING gin (batch_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_plant_varieties_name_trgm 
  ON plant_varieties USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_plant_varieties_family_trgm 
  ON plant_varieties USING gin (family gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_nursery_locations_name_trgm 
  ON nursery_locations USING gin (name gin_trgm_ops);

-- Standard btree indexes as fallback
CREATE INDEX IF NOT EXISTS idx_batches_batch_number_btree 
  ON batches (batch_number);

CREATE INDEX IF NOT EXISTS idx_plant_varieties_name_btree 
  ON plant_varieties (name);

CREATE INDEX IF NOT EXISTS idx_nursery_locations_name_btree 
  ON nursery_locations (name);

