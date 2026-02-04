-- Migration: Customer Milestones Table with Auto-Anniversary Trigger
-- Purpose: Track important dates and events for customers
-- Part of: Customer Pages Enhancement (Phase 3)

-- =============================================================================
-- Table: customer_milestones
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_milestones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  milestone_type text NOT NULL CHECK (milestone_type IN (
    'anniversary', 'first_order', 'contract_renewal', 'seasonal_peak', 'custom'
  )),
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  recurring boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_milestones_customer_date
  ON customer_milestones(customer_id, event_date);

CREATE INDEX IF NOT EXISTS idx_milestones_org_date
  ON customer_milestones(org_id, event_date);

-- Enable RLS
ALTER TABLE customer_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view milestones in their org"
  ON customer_milestones FOR SELECT
  USING (user_in_org(org_id));

CREATE POLICY "Users can create milestones in their org"
  ON customer_milestones FOR INSERT
  WITH CHECK (user_in_org(org_id));

CREATE POLICY "Users can update milestones in their org"
  ON customer_milestones FOR UPDATE
  USING (user_in_org(org_id));

CREATE POLICY "Users can delete milestones in their org"
  ON customer_milestones FOR DELETE
  USING (user_in_org(org_id));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_milestones TO authenticated;

-- =============================================================================
-- Trigger: Auto-create anniversary milestone on first confirmed order
-- =============================================================================

CREATE OR REPLACE FUNCTION create_customer_anniversary_milestone()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_anniversary uuid;
  v_first_order boolean;
BEGIN
  -- Only trigger when status changes to 'confirmed' from 'draft'
  IF NEW.status = 'confirmed' AND (OLD.status = 'draft' OR OLD.status IS NULL) THEN

    -- Check if this is the customer's first non-draft order
    SELECT NOT EXISTS (
      SELECT 1 FROM orders
      WHERE customer_id = NEW.customer_id
        AND id != NEW.id
        AND status NOT IN ('draft', 'cancelled', 'void')
    ) INTO v_first_order;

    IF v_first_order THEN
      -- Check if anniversary milestone already exists for this customer
      SELECT id INTO v_existing_anniversary
      FROM customer_milestones
      WHERE customer_id = NEW.customer_id
        AND milestone_type = 'anniversary'
      LIMIT 1;

      -- Only create if no anniversary exists
      IF v_existing_anniversary IS NULL THEN
        INSERT INTO customer_milestones (
          org_id,
          customer_id,
          milestone_type,
          title,
          description,
          event_date,
          recurring
        ) VALUES (
          NEW.org_id,
          NEW.customer_id,
          'anniversary',
          'Customer Anniversary',
          'First order placed on this date',
          (NEW.created_at AT TIME ZONE 'UTC')::date,
          true
        );

        -- Also create a first_order milestone (non-recurring, for history)
        INSERT INTO customer_milestones (
          org_id,
          customer_id,
          milestone_type,
          title,
          description,
          event_date,
          recurring
        ) VALUES (
          NEW.org_id,
          NEW.customer_id,
          'first_order',
          'First Order',
          'Customer placed their first order',
          (NEW.created_at AT TIME ZONE 'UTC')::date,
          false
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_create_anniversary_on_first_order ON orders;
CREATE TRIGGER trg_create_anniversary_on_first_order
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_customer_anniversary_milestone();

-- Also trigger on INSERT for orders created directly as confirmed
DROP TRIGGER IF EXISTS trg_create_anniversary_on_first_order_insert ON orders;
CREATE TRIGGER trg_create_anniversary_on_first_order_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION create_customer_anniversary_milestone();

-- Comments
COMMENT ON TABLE customer_milestones IS 'Tracks important dates and recurring events for customers';
COMMENT ON COLUMN customer_milestones.milestone_type IS 'Type: anniversary, first_order, contract_renewal, seasonal_peak, custom';
COMMENT ON COLUMN customer_milestones.recurring IS 'If true, shows annually on event_date (month/day)';
COMMENT ON FUNCTION create_customer_anniversary_milestone() IS 'Auto-creates anniversary milestone when customer places first order';
