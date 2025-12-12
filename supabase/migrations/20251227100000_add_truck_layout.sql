-- Add truck_layout column to haulier_vehicles for visual truck configuration
-- This stores the layout configuration for displaying trolleys in the driver view

ALTER TABLE haulier_vehicles 
ADD COLUMN IF NOT EXISTS truck_layout jsonb DEFAULT '{
  "type": "van",
  "rows": 2,
  "columns": 5,
  "trolleySlots": 10
}'::jsonb;

-- Add a comment explaining the structure
COMMENT ON COLUMN haulier_vehicles.truck_layout IS 
'JSON configuration for truck visualization: { type: "van"|"truck"|"trailer", rows: number, columns: number, trolleySlots: number }';

-- Update existing vehicles with appropriate default layouts based on vehicle_type
UPDATE haulier_vehicles
SET truck_layout = CASE 
  WHEN vehicle_type = 'van' THEN '{"type": "van", "rows": 2, "columns": 5, "trolleySlots": 10}'::jsonb
  WHEN vehicle_type = 'truck' THEN '{"type": "truck", "rows": 3, "columns": 10, "trolleySlots": 30}'::jsonb
  WHEN vehicle_type = 'trailer' THEN '{"type": "trailer", "rows": 4, "columns": 15, "trolleySlots": 60}'::jsonb
  ELSE '{"type": "van", "rows": 2, "columns": 5, "trolleySlots": 10}'::jsonb
END
WHERE truck_layout IS NULL OR truck_layout = '{}'::jsonb;

-- Also add layout configuration to the legacy vehicles table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'truck_layout') THEN
      ALTER TABLE vehicles ADD COLUMN truck_layout jsonb DEFAULT '{"type": "van", "rows": 2, "columns": 5, "trolleySlots": 10}'::jsonb;
    END IF;
  END IF;
END
$$;

