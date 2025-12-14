-- Migration: Make batches.location_id nullable
-- This allows planned batches to be created without a location assigned
-- The location can be set when the batch is activated/actualized

-- Drop the NOT NULL constraint on location_id
ALTER TABLE public.batches
ALTER COLUMN location_id DROP NOT NULL;

-- Add a comment explaining the nullable nature
COMMENT ON COLUMN public.batches.location_id IS
  'Location of the batch. Nullable to allow planned batches without assigned location.';
