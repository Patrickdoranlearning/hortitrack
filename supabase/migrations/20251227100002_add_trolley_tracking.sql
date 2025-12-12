-- Extend trolley tracking system for customer/haulier balances
-- This adds shelf tracking and a simpler movement log for count-based tracking

-- Add shelves_out column to existing customer_trolley_balance table
ALTER TABLE customer_trolley_balance 
  ADD COLUMN IF NOT EXISTS shelves_out integer NOT NULL DEFAULT 0;

-- Equipment movement log - simpler table for count-based tracking
-- This doesn't require individual trolley records, just counts
CREATE TABLE IF NOT EXISTS equipment_movement_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Movement info
  movement_date timestamptz NOT NULL DEFAULT now(),
  movement_type text NOT NULL CHECK (movement_type IN ('delivered', 'returned', 'not_returned', 'adjustment')),
  
  -- Customer
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Quantities (positive numbers - direction determined by movement_type)
  trolleys integer NOT NULL DEFAULT 0,
  shelves integer NOT NULL DEFAULT 0,
  
  -- Delivery context (optional links)
  delivery_run_id uuid REFERENCES delivery_runs(id) ON DELETE SET NULL,
  
  -- Documentation
  notes text,
  signed_docket_url text,
  
  -- Audit
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_equipment_movement_log_org ON equipment_movement_log(org_id);
CREATE INDEX IF NOT EXISTS idx_equipment_movement_log_customer ON equipment_movement_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_equipment_movement_log_date ON equipment_movement_log(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_movement_log_type ON equipment_movement_log(movement_type);
CREATE INDEX IF NOT EXISTS idx_equipment_movement_log_not_returned 
  ON equipment_movement_log(org_id, customer_id) 
  WHERE movement_type = 'not_returned';

-- Enable RLS
ALTER TABLE equipment_movement_log ENABLE ROW LEVEL SECURITY;

-- RLS policies using org_memberships table
CREATE POLICY "Users can view equipment movements in their org"
  ON equipment_movement_log FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert equipment movements in their org"
  ON equipment_movement_log FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update equipment movements in their org"
  ON equipment_movement_log FOR UPDATE
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete equipment movements in their org"
  ON equipment_movement_log FOR DELETE
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));
