-- Scout Wizard Extensions
-- Adds photo support to health logs and treatment type categorization

-- 1. Add photo_url to plant_health_logs
ALTER TABLE public.plant_health_logs
ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. Add affected_batch_ids to plant_health_logs
ALTER TABLE public.plant_health_logs
ADD COLUMN IF NOT EXISTS affected_batch_ids uuid[];

-- 3. Add treatment_type to ipm_spot_treatments
ALTER TABLE public.ipm_spot_treatments
ADD COLUMN IF NOT EXISTS treatment_type text DEFAULT 'chemical';

-- 4. Add mechanical action types for mechanical treatments
ALTER TABLE public.ipm_spot_treatments
ADD COLUMN IF NOT EXISTS mechanical_action text; -- 'trimming', 'spacing', 'weeding', 'removing'

-- 5. Add feeding details for feeding treatments
ALTER TABLE public.ipm_spot_treatments
ADD COLUMN IF NOT EXISTS fertilizer_name text;
ALTER TABLE public.ipm_spot_treatments
ADD COLUMN IF NOT EXISTS fertilizer_rate numeric;
ALTER TABLE public.ipm_spot_treatments
ADD COLUMN IF NOT EXISTS fertilizer_unit text;

-- 6. Add triggered_by field to link treatments to health logs
ALTER TABLE public.ipm_spot_treatments
ADD COLUMN IF NOT EXISTS triggered_by_log_id uuid REFERENCES public.plant_health_logs(id);

-- 7. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ipm_spot_treatments_triggered_by
ON public.ipm_spot_treatments(triggered_by_log_id);

-- 8. Add comments for documentation
COMMENT ON COLUMN public.ipm_spot_treatments.treatment_type IS 'Type of treatment: chemical (IPM products), mechanical (physical intervention), or feeding (nutrient application)';
COMMENT ON COLUMN public.ipm_spot_treatments.mechanical_action IS 'For mechanical treatments: trimming, spacing, weeding, or removing';
COMMENT ON COLUMN public.plant_health_logs.photo_url IS 'URL to photo documenting the issue or reading';
COMMENT ON COLUMN public.plant_health_logs.affected_batch_ids IS 'Array of batch IDs affected by this issue';

