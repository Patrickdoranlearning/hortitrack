-- Add tray and trolley quantity columns to plant_sizes
-- These columns complete the unit hierarchy: Units → Trays → Shelves → Trolleys

ALTER TABLE plant_sizes
  ADD COLUMN IF NOT EXISTS tray_quantity integer,
  ADD COLUMN IF NOT EXISTS trolley_quantity integer;

-- Add comments for documentation
COMMENT ON COLUMN plant_sizes.tray_quantity IS 'Number of units that fit in a standard tray/flat (e.g., 54 cells per tray)';
COMMENT ON COLUMN plant_sizes.shelf_quantity IS 'Number of units that fit on a standard Danish trolley shelf';
COMMENT ON COLUMN plant_sizes.trolley_quantity IS 'Number of units that fit on a full trolley (typically shelf_quantity × 6)';
