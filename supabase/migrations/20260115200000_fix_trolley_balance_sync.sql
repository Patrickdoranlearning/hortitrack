-- Fix trolley balance synchronization
-- The movement log is the source of truth, not delivery_items
-- This migration:
-- 1. Creates a function to recalculate balance from equipment_movement_log
-- 2. Adds a trigger on equipment_movement_log to auto-sync balances
-- 3. Deprecates the delivery_items trigger (which caused double-counting)

-- Function to recalculate customer trolley balance from movement log
-- This is the single source of truth for balance calculation
CREATE OR REPLACE FUNCTION recalculate_customer_trolley_balance(
  p_customer_id uuid,
  p_org_id uuid
)
RETURNS void AS $$
DECLARE
  v_delivered integer;
  v_returned integer;
  v_adjustments integer;
  v_balance integer;
  v_last_delivery timestamptz;
  v_last_return timestamptz;
BEGIN
  -- Sum all delivered trolleys
  SELECT COALESCE(SUM(trolleys), 0)
  INTO v_delivered
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'delivered';

  -- Sum all returned trolleys
  SELECT COALESCE(SUM(trolleys), 0)
  INTO v_returned
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'returned';

  -- Sum all adjustments (can be positive or negative conceptually,
  -- but stored as positive with 'adjustment' type meaning reduction)
  SELECT COALESCE(SUM(trolleys), 0)
  INTO v_adjustments
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'adjustment';

  -- Calculate balance: delivered - returned - adjustments
  v_balance := v_delivered - v_returned - v_adjustments;

  -- Get last delivery date
  SELECT MAX(movement_date)
  INTO v_last_delivery
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'delivered';

  -- Get last return date
  SELECT MAX(movement_date)
  INTO v_last_return
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'returned';

  -- Upsert balance (ensure non-negative)
  INSERT INTO customer_trolley_balance (
    org_id,
    customer_id,
    trolleys_out,
    last_delivery_date,
    last_return_date,
    updated_at
  )
  VALUES (
    p_org_id,
    p_customer_id,
    GREATEST(0, v_balance),
    v_last_delivery,
    v_last_return,
    now()
  )
  ON CONFLICT (org_id, customer_id) DO UPDATE SET
    trolleys_out = GREATEST(0, v_balance),
    last_delivery_date = COALESCE(v_last_delivery, customer_trolley_balance.last_delivery_date),
    last_return_date = COALESCE(v_last_return, customer_trolley_balance.last_return_date),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION recalculate_customer_trolley_balance(uuid, uuid) IS
  'Recalculates customer trolley balance from equipment_movement_log. '
  'Balance = SUM(delivered) - SUM(returned) - SUM(adjustments). '
  'This is the single source of truth for trolley balances.';

-- Trigger function to sync balance when movement log changes
CREATE OR REPLACE FUNCTION sync_trolley_balance_from_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate balance for the affected customer
  PERFORM recalculate_customer_trolley_balance(NEW.customer_id, NEW.org_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for DELETE operations (uses OLD instead of NEW)
CREATE OR REPLACE FUNCTION sync_trolley_balance_from_movement_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate balance for the affected customer
  PERFORM recalculate_customer_trolley_balance(OLD.customer_id, OLD.org_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trg_sync_trolley_balance_on_movement ON equipment_movement_log;
DROP TRIGGER IF EXISTS trg_sync_trolley_balance_on_movement_delete ON equipment_movement_log;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER trg_sync_trolley_balance_on_movement
  AFTER INSERT OR UPDATE ON equipment_movement_log
  FOR EACH ROW
  EXECUTE FUNCTION sync_trolley_balance_from_movement();

-- Create trigger for DELETE
CREATE TRIGGER trg_sync_trolley_balance_on_movement_delete
  AFTER DELETE ON equipment_movement_log
  FOR EACH ROW
  EXECUTE FUNCTION sync_trolley_balance_from_movement_delete();

-- Disable the old delivery_items trigger that caused double-counting
-- The complete-delivery endpoint already writes to equipment_movement_log,
-- so having the delivery_items trigger also update balance causes issues
DROP TRIGGER IF EXISTS trg_update_customer_trolley_balance ON delivery_items;

-- Add comment explaining why we disabled it
COMMENT ON FUNCTION update_customer_trolley_balance() IS
  'DEPRECATED: This trigger has been disabled as of 20260115200000. '
  'Trolley balances are now calculated from equipment_movement_log only. '
  'The complete-delivery endpoint writes to equipment_movement_log, '
  'which triggers recalculate_customer_trolley_balance automatically.';

-- Run initial sync to fix any existing inconsistencies
-- This recalculates all customer balances from the movement log
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Get all unique customer/org combinations from the movement log
  FOR r IN
    SELECT DISTINCT customer_id, org_id
    FROM equipment_movement_log
  LOOP
    PERFORM recalculate_customer_trolley_balance(r.customer_id, r.org_id);
  END LOOP;
END $$;
