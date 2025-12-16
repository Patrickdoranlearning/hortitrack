-- Trolley Capacity Configuration
-- Stores shelves-per-trolley for family + size combinations
-- Used to calculate estimated trolleys needed for orders

CREATE TABLE public.trolley_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Matching criteria (both nullable for flexible matching)
  -- NULL family = applies to all families for this size
  -- NULL size_id = applies to all sizes for this family
  -- Both NULL = global default for this org
  family text,
  size_id uuid REFERENCES plant_sizes(id) ON DELETE CASCADE,

  -- Capacity configuration
  shelves_per_trolley smallint NOT NULL DEFAULT 6,
  notes text,

  -- Audit fields
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT trolley_capacity_valid_shelves CHECK (shelves_per_trolley BETWEEN 1 AND 16),
  -- One record per org/family/size combination (NULLS NOT DISTINCT treats NULLs as equal)
  CONSTRAINT trolley_capacity_unique_combo UNIQUE NULLS NOT DISTINCT (org_id, family, size_id)
);

-- Comments
COMMENT ON TABLE trolley_capacity IS 'Configures how many shelves fit on a trolley for each plant family + pot size combination';
COMMENT ON COLUMN trolley_capacity.family IS 'Plant family (e.g., Lamiaceae). NULL means this config applies to all families.';
COMMENT ON COLUMN trolley_capacity.size_id IS 'Reference to plant_sizes. NULL means this config applies to all sizes.';
COMMENT ON COLUMN trolley_capacity.shelves_per_trolley IS 'Number of shelves that fit on a trolley (1-16). Lower = taller plants.';

-- Indexes
CREATE INDEX idx_trolley_capacity_org ON trolley_capacity(org_id);
CREATE INDEX idx_trolley_capacity_lookup ON trolley_capacity(org_id, family, size_id);

-- Enable RLS
ALTER TABLE trolley_capacity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "trolley_capacity_org_read" ON trolley_capacity
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "trolley_capacity_org_insert" ON trolley_capacity
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "trolley_capacity_org_update" ON trolley_capacity
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "trolley_capacity_org_delete" ON trolley_capacity
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

-- Service role bypass for server-side operations
CREATE POLICY "trolley_capacity_service_all" ON trolley_capacity
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON trolley_capacity TO authenticated;
GRANT ALL ON trolley_capacity TO service_role;
