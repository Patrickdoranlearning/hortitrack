-- Tasks Module Enhancement: Add team assignment support
-- This allows dispatch/picking tasks to be assigned to picking teams

-- =============================================================================
-- ADD assigned_team_id TO TASKS TABLE
-- =============================================================================

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS assigned_team_id UUID REFERENCES public.picking_teams(id) ON DELETE SET NULL;

-- Create index for team-based queries
CREATE INDEX IF NOT EXISTS tasks_assigned_team_id_idx ON public.tasks(assigned_team_id);

-- =============================================================================
-- UPDATE tasks_with_productivity VIEW
-- =============================================================================

DROP VIEW IF EXISTS public.tasks_with_productivity CASCADE;

CREATE VIEW public.tasks_with_productivity AS
SELECT 
  t.*,
  CASE 
    WHEN t.completed_at IS NOT NULL AND t.started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) / 60 
    ELSE NULL 
  END AS duration_minutes,
  CASE 
    WHEN t.completed_at IS NOT NULL 
      AND t.started_at IS NOT NULL 
      AND t.plant_quantity IS NOT NULL 
      AND EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) > 0
    THEN (t.plant_quantity::NUMERIC / (EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) / 60)) * 60
    ELSE NULL 
  END AS plants_per_hour,
  p.display_name AS assigned_to_name,
  p.email AS assigned_to_email,
  pt.name AS assigned_team_name
FROM public.tasks t
LEFT JOIN public.profiles p ON t.assigned_to = p.id
LEFT JOIN public.picking_teams pt ON t.assigned_team_id = pt.id;

-- Grant access to the view
GRANT SELECT ON public.tasks_with_productivity TO authenticated;
GRANT SELECT ON public.tasks_with_productivity TO service_role;


