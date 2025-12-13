-- Add compliance logging fields to ipm_tasks and plant_health_logs
-- Required for pesticide application records

-- IPM Tasks - compliance fields for chemical applications
ALTER TABLE public.ipm_tasks
ADD COLUMN IF NOT EXISTS pcs_number text,
ADD COLUMN IF NOT EXISTS crop_name text,
ADD COLUMN IF NOT EXISTS reason_for_use text,
ADD COLUMN IF NOT EXISTS weather_conditions text,
ADD COLUMN IF NOT EXISTS harvest_interval_days integer,
ADD COLUMN IF NOT EXISTS safe_harvest_date date,
ADD COLUMN IF NOT EXISTS area_treated text,
ADD COLUMN IF NOT EXISTS sprayer_used text,
ADD COLUMN IF NOT EXISTS signed_by text,
ADD COLUMN IF NOT EXISTS fertiliser_composition text;

-- Plant Health Logs - same fields for audit trail (linked to batches)
ALTER TABLE public.plant_health_logs
ADD COLUMN IF NOT EXISTS pcs_number text,
ADD COLUMN IF NOT EXISTS crop_name text,
ADD COLUMN IF NOT EXISTS reason_for_use text,
ADD COLUMN IF NOT EXISTS weather_conditions text,
ADD COLUMN IF NOT EXISTS harvest_interval_days integer,
ADD COLUMN IF NOT EXISTS safe_harvest_date date,
ADD COLUMN IF NOT EXISTS area_treated text,
ADD COLUMN IF NOT EXISTS sprayer_used text,
ADD COLUMN IF NOT EXISTS signed_by text,
ADD COLUMN IF NOT EXISTS fertiliser_composition text,
ADD COLUMN IF NOT EXISTS ipm_task_id uuid REFERENCES public.ipm_tasks(id);

-- Index for finding logs by task
CREATE INDEX IF NOT EXISTS idx_plant_health_logs_ipm_task 
ON public.plant_health_logs(ipm_task_id);

COMMENT ON COLUMN public.ipm_tasks.pcs_number IS 'PCS (Pesticide Control Service) registration number';
COMMENT ON COLUMN public.ipm_tasks.safe_harvest_date IS 'Calculated date after which harvest is safe (based on WHI)';
COMMENT ON COLUMN public.ipm_tasks.signed_by IS 'Name of person who applied the treatment';

