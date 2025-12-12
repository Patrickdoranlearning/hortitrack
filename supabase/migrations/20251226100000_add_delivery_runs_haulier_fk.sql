-- Add missing foreign key constraints for delivery_runs
-- These are required for Supabase nested select syntax to work

-- Add FK from delivery_runs to hauliers (was missing - caused PGRST200 error)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'delivery_runs_haulier_id_fkey'
    AND table_name = 'delivery_runs'
  ) THEN
    ALTER TABLE public.delivery_runs
    ADD CONSTRAINT delivery_runs_haulier_id_fkey 
    FOREIGN KEY (haulier_id) REFERENCES public.hauliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add FK from delivery_runs to haulier_vehicles (if vehicle_id column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'delivery_runs' AND column_name = 'vehicle_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'delivery_runs_vehicle_id_fkey'
    AND table_name = 'delivery_runs'
  ) THEN
    ALTER TABLE public.delivery_runs
    ADD CONSTRAINT delivery_runs_vehicle_id_fkey 
    FOREIGN KEY (vehicle_id) REFERENCES public.haulier_vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON CONSTRAINT delivery_runs_haulier_id_fkey ON public.delivery_runs IS
  'FK to hauliers table - enables Supabase nested select for haulier data';

