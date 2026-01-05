-- Migration: Add unique constraint on task source references
-- This prevents duplicate tasks being created for the same source record
-- e.g., prevents two tasks for the same pick list

-- Create unique index on source references (partial index - only when source_ref_id is not null)
-- This allows multiple tasks with NULL source_ref_id (standalone tasks)
CREATE UNIQUE INDEX IF NOT EXISTS tasks_source_ref_unique_idx 
  ON public.tasks(org_id, source_module, source_ref_type, source_ref_id) 
  WHERE source_ref_id IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON INDEX public.tasks_source_ref_unique_idx IS 
  'Prevents duplicate tasks for the same source reference (e.g., two tasks for one pick list). Allows NULL source_ref_id for standalone tasks.';


