-- Add email column to profiles table
-- This column is required by tasks_with_productivity and production_jobs_summary views

-- Add the email column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill email from auth.users where possible
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL
  AND u.email IS NOT NULL;

-- Recreate the tasks_with_productivity view to pick up the new column
DROP VIEW IF EXISTS public.tasks_with_productivity CASCADE;
CREATE VIEW public.tasks_with_productivity
WITH (security_invoker = true)
AS
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

GRANT SELECT ON public.tasks_with_productivity TO authenticated;
GRANT SELECT ON public.tasks_with_productivity TO service_role;

-- Recreate the production_jobs_summary view as well
DROP VIEW IF EXISTS public.production_jobs_summary CASCADE;
CREATE VIEW public.production_jobs_summary
WITH (security_invoker = true)
AS
SELECT
  j.*,
  COALESCE(batch_stats.batch_count, 0) AS batch_count,
  COALESCE(batch_stats.total_plants, 0) AS total_plants,
  p.display_name AS assigned_to_name,
  p.email AS assigned_to_email,
  CASE
    WHEN j.completed_at IS NOT NULL AND j.started_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (j.completed_at - j.started_at)) / 60
    ELSE NULL
  END AS duration_minutes
FROM public.production_jobs j
LEFT JOIN public.profiles p ON j.assigned_to = p.id
LEFT JOIN (
  SELECT
    pjb.job_id,
    COUNT(*)::INT AS batch_count,
    SUM(b.quantity)::INT AS total_plants
  FROM public.production_job_batches pjb
  JOIN public.batches b ON pjb.batch_id = b.id
  GROUP BY pjb.job_id
) batch_stats ON j.id = batch_stats.job_id;

GRANT SELECT ON public.production_jobs_summary TO authenticated;
GRANT SELECT ON public.production_jobs_summary TO service_role;
