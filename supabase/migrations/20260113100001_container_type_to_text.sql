-- Convert container_type from enum to text to allow tenant-configurable values
-- The container types are now managed through the dropdown manager (attribute_options)

-- Step 0: Drop dependent view
DROP VIEW IF EXISTS public.lookup_sizes CASCADE;

-- Step 1: Add a temporary text column
ALTER TABLE public.plant_sizes ADD COLUMN IF NOT EXISTS container_type_text text;

-- Step 2: Copy data from enum column to text column
UPDATE public.plant_sizes
SET container_type_text = container_type::text
WHERE container_type_text IS NULL;

-- Step 3: Drop the enum column
ALTER TABLE public.plant_sizes DROP COLUMN IF EXISTS container_type;

-- Step 4: Rename the text column
ALTER TABLE public.plant_sizes RENAME COLUMN container_type_text TO container_type;

-- Step 5: Set not null and default
ALTER TABLE public.plant_sizes
  ALTER COLUMN container_type SET NOT NULL,
  ALTER COLUMN container_type SET DEFAULT 'pot';

-- Step 6: Recreate the lookup_sizes view with the new text column
CREATE VIEW public.lookup_sizes
WITH (security_invoker = true)
AS
SELECT
  id, name, container_type, cell_multiple
FROM public.plant_sizes;

-- Note: We keep the enum type in the database for backwards compatibility
-- but it is no longer used by the plant_sizes table
