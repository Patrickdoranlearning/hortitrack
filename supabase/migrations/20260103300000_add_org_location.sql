-- Add location coordinates to organizations for weather integration
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Add comment explaining the fields
COMMENT ON COLUMN organizations.latitude IS 'Latitude coordinate for weather lookups';
COMMENT ON COLUMN organizations.longitude IS 'Longitude coordinate for weather lookups';

-- Default to Ireland (Dublin) for existing orgs without coordinates
UPDATE organizations 
SET latitude = 53.3498, longitude = -6.2603 
WHERE latitude IS NULL;

