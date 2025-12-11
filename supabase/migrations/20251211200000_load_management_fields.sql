-- Load Management Fields Migration
-- Adds fields to support load capacity, naming, and display ordering

-- ============================================================
-- 1. Add trolley_capacity to hauliers
-- ============================================================
ALTER TABLE public.hauliers
ADD COLUMN IF NOT EXISTS trolley_capacity integer DEFAULT 20;

COMMENT ON COLUMN public.hauliers.trolley_capacity IS 'Maximum number of trolleys this haulier/vehicle can carry';

-- ============================================================
-- 2. Add load_name to delivery_runs for custom naming
-- ============================================================
ALTER TABLE public.delivery_runs
ADD COLUMN IF NOT EXISTS load_name text;

COMMENT ON COLUMN public.delivery_runs.load_name IS 'Custom name for the load (e.g., "Cork Load 1")';

-- ============================================================
-- 3. Add week_number to delivery_runs for week filtering
-- ============================================================
ALTER TABLE public.delivery_runs
ADD COLUMN IF NOT EXISTS week_number integer;

-- Populate week_number from run_date for existing records
UPDATE public.delivery_runs
SET week_number = EXTRACT(WEEK FROM run_date::date)
WHERE week_number IS NULL AND run_date IS NOT NULL;

COMMENT ON COLUMN public.delivery_runs.week_number IS 'ISO week number of the delivery run';

-- ============================================================
-- 4. Add display_order to delivery_runs for custom ordering
-- ============================================================
ALTER TABLE public.delivery_runs
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

COMMENT ON COLUMN public.delivery_runs.display_order IS 'Order in which loads are displayed on the dispatch board';

-- ============================================================
-- 5. Create trigger to auto-populate week_number
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_delivery_run_week_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.run_date IS NOT NULL THEN
    NEW.week_number := EXTRACT(WEEK FROM NEW.run_date::date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_delivery_run_week_number ON public.delivery_runs;
CREATE TRIGGER trg_set_delivery_run_week_number
  BEFORE INSERT OR UPDATE OF run_date ON public.delivery_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivery_run_week_number();

-- ============================================================
-- 6. Add index for week filtering
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_delivery_runs_week_number 
ON public.delivery_runs (org_id, week_number, run_date);

CREATE INDEX IF NOT EXISTS idx_delivery_runs_display_order
ON public.delivery_runs (org_id, display_order);
