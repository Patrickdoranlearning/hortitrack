-- Fix extension_in_public warnings
-- Move pg_trgm and citext extensions from public schema to extensions schema
-- This prevents potential security issues from having extensions in the public schema

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema first
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT USAGE ON SCHEMA extensions TO anon;

-- ============================================================================
-- Move pg_trgm extension to extensions schema
-- This will DROP dependent indexes, which we'll recreate below
-- ============================================================================
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Recreate gin_trgm indexes that were dropped
CREATE INDEX IF NOT EXISTS idx_batches_batch_number_trgm
  ON public.batches USING gin (batch_number extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_plant_varieties_name_trgm
  ON public.plant_varieties USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_plant_varieties_family_trgm
  ON public.plant_varieties USING gin (family extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_nursery_locations_name_trgm
  ON public.nursery_locations USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_varieties_name_trgm
  ON public.plant_varieties USING gin (name extensions.gin_trgm_ops);

-- ============================================================================
-- Move citext extension to extensions schema
-- ============================================================================
DROP EXTENSION IF EXISTS citext CASCADE;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;
