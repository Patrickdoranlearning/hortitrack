-- Plant Health Module Extensions
-- Adds compliance-ready columns to plant_health_logs and health status to nursery_locations

-- 1. Extend plant_health_logs for detailed compliance reporting
ALTER TABLE public.plant_health_logs
ADD COLUMN IF NOT EXISTS product_name text,
ADD COLUMN IF NOT EXISTS rate numeric,
ADD COLUMN IF NOT EXISTS unit text,
ADD COLUMN IF NOT EXISTS method text,
ADD COLUMN IF NOT EXISTS ec_reading numeric,
ADD COLUMN IF NOT EXISTS ph_reading numeric,
ADD COLUMN IF NOT EXISTS issue_reason text,
ADD COLUMN IF NOT EXISTS severity text;

COMMENT ON COLUMN public.plant_health_logs.product_name IS 'Chemical or product name (e.g., RoundUp, Nemasys, Fungicide X)';
COMMENT ON COLUMN public.plant_health_logs.rate IS 'Application rate value';
COMMENT ON COLUMN public.plant_health_logs.unit IS 'Unit of measurement (e.g., ml/L, g/L, kg/ha)';
COMMENT ON COLUMN public.plant_health_logs.method IS 'Application method (e.g., Foliar Spray, Drench, Bio-Control)';
COMMENT ON COLUMN public.plant_health_logs.ec_reading IS 'Electrical conductivity (EC/salt level) measurement';
COMMENT ON COLUMN public.plant_health_logs.ph_reading IS 'pH measurement';
COMMENT ON COLUMN public.plant_health_logs.issue_reason IS 'Reason for flagging (e.g., Aphids, Fungal Infection, Nutrient Deficiency)';
COMMENT ON COLUMN public.plant_health_logs.severity IS 'Issue severity: low (monitor), medium (treat), critical (quarantine)';

-- Add check constraint for severity values
ALTER TABLE public.plant_health_logs
ADD CONSTRAINT plant_health_logs_severity_check 
CHECK (severity IS NULL OR severity IN ('low', 'medium', 'critical'));

-- 2. Add health status fields to nursery_locations for safety locks
ALTER TABLE public.nursery_locations
ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'clean',
ADD COLUMN IF NOT EXISTS restricted_until timestamptz;

COMMENT ON COLUMN public.nursery_locations.health_status IS 'Location health status: clean, infested, restricted';
COMMENT ON COLUMN public.nursery_locations.restricted_until IS 'Safety lock - location restricted until this timestamp (REI expiry)';

-- Add check constraint for health_status values
ALTER TABLE public.nursery_locations
ADD CONSTRAINT nursery_locations_health_status_check 
CHECK (health_status IS NULL OR health_status IN ('clean', 'infested', 'restricted'));

-- 3. Create index for efficient safety lock checks
CREATE INDEX IF NOT EXISTS idx_nursery_locations_restricted 
ON public.nursery_locations(restricted_until)
WHERE restricted_until IS NOT NULL;

-- 4. Create index for querying treatments by product (for compliance reports)
CREATE INDEX IF NOT EXISTS idx_plant_health_logs_product_name 
ON public.plant_health_logs(product_name)
WHERE product_name IS NOT NULL;

-- 5. Create index for severity-based queries
CREATE INDEX IF NOT EXISTS idx_plant_health_logs_severity 
ON public.plant_health_logs(severity)
WHERE severity IS NOT NULL;

