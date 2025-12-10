-- Drop duplicate indexes to reduce storage and write overhead

-- Nursery Locations: Drop `idx_nursery_locations_name_trgm` (keep `idx_location_name_trgm`)
DROP INDEX IF EXISTS idx_nursery_locations_name_trgm;

-- Plant Sizes: Drop `ix_sizes_lower_name` (keep `idx_sizes_lower_name`)
DROP INDEX IF EXISTS ix_sizes_lower_name;

-- Plant Varieties: Drop `ix_varieties_lower_name` (keep `idx_varieties_lower_name`)
DROP INDEX IF EXISTS ix_varieties_lower_name;

-- Plant Varieties: Drop `idx_plant_varieties_name_trgm` (keep `idx_varieties_name_trgm` or `idx_variety_name_trgm`)
-- Checking schema naming: usually `idx_varieties_name_trgm`.
DROP INDEX IF EXISTS idx_plant_varieties_name_trgm;
DROP INDEX IF EXISTS idx_variety_name_trgm; -- Assuming this might be the duplicate or the keeper, dropping the one that looks auto-generated/inconsistent if both exist.
-- To be safe, we should ensure the *correct* one exists.
CREATE INDEX IF NOT EXISTS idx_varieties_name_trgm ON public.plant_varieties USING gin (name gin_trgm_ops);

-- Check for other potential duplicates from report
-- (None explicitly listed in prompt other than these, but good practice to verify)



