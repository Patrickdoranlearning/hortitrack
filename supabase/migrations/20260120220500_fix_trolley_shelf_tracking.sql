-- ================================================
-- FIX TROLLEY AND SHELF TRACKING
-- ================================================
-- This migration fixes two issues:
-- 1. shelves_out was never being calculated in customer_trolley_balance
-- 2. Adds shelf tracking to the balance calculation
-- ================================================

-- Update the recalculate function to include shelf tracking
CREATE OR REPLACE FUNCTION recalculate_customer_trolley_balance(
  p_customer_id uuid,
  p_org_id uuid
)
RETURNS void AS $$
DECLARE
  v_trolleys_delivered integer;
  v_trolleys_returned integer;
  v_trolleys_adjustments integer;
  v_trolleys_balance integer;
  v_shelves_delivered integer;
  v_shelves_returned integer;
  v_shelves_adjustments integer;
  v_shelves_balance integer;
  v_last_delivery timestamptz;
  v_last_return timestamptz;
BEGIN
  -- Sum all delivered trolleys
  SELECT COALESCE(SUM(trolleys), 0)
  INTO v_trolleys_delivered
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'delivered';

  -- Sum all returned trolleys
  SELECT COALESCE(SUM(trolleys), 0)
  INTO v_trolleys_returned
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'returned';

  -- Sum all trolley adjustments
  SELECT COALESCE(SUM(trolleys), 0)
  INTO v_trolleys_adjustments
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'adjustment';

  -- Sum all delivered shelves
  SELECT COALESCE(SUM(shelves), 0)
  INTO v_shelves_delivered
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'delivered';

  -- Sum all returned shelves
  SELECT COALESCE(SUM(shelves), 0)
  INTO v_shelves_returned
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'returned';

  -- Sum all shelf adjustments
  SELECT COALESCE(SUM(shelves), 0)
  INTO v_shelves_adjustments
  FROM equipment_movement_log
  WHERE customer_id = p_customer_id
    AND org_id = p_org_id
    AND movement_type = 'adjustment';

  -- Calculate balances
  v_trolleys_balance := v_trolleys_delivered - v_trolleys_returned - v_trolleys_adjustments;
  v_shelves_balance := v_shelves_delivered - v_shelves_returned - v_shelves_adjustments;

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
    shelves_out,
    last_delivery_date,
    last_return_date,
    updated_at
  )
  VALUES (
    p_org_id,
    p_customer_id,
    GREATEST(0, v_trolleys_balance),
    GREATEST(0, v_shelves_balance),
    v_last_delivery,
    v_last_return,
    now()
  )
  ON CONFLICT (org_id, customer_id) DO UPDATE SET
    trolleys_out = GREATEST(0, v_trolleys_balance),
    shelves_out = GREATEST(0, v_shelves_balance),
    last_delivery_date = COALESCE(v_last_delivery, customer_trolley_balance.last_delivery_date),
    last_return_date = COALESCE(v_last_return, customer_trolley_balance.last_return_date),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_customer_trolley_balance(uuid, uuid) IS
  'Recalculates customer trolley AND shelf balance from equipment_movement_log. '
  'Balance = SUM(delivered) - SUM(returned) - SUM(adjustments). '
  'Updated in 20260120220000 to include shelf tracking.';

-- ================================================
-- RECALCULATE HAULIER BALANCE FUNCTION
-- ================================================
-- Similar function for haulier balance recalculation

CREATE OR REPLACE FUNCTION recalculate_haulier_trolley_balance(
  p_haulier_id uuid,
  p_org_id uuid
)
RETURNS void AS $$
DECLARE
  v_trolleys_loaded integer;
  v_trolleys_returned integer;
  v_trolleys_transferred integer;
  v_trolleys_balance integer;
  v_shelves_loaded integer;
  v_shelves_returned integer;
  v_shelves_transferred integer;
  v_shelves_balance integer;
  v_last_load timestamptz;
  v_last_return timestamptz;
BEGIN
  -- Sum all loaded trolleys from delivery_runs
  SELECT COALESCE(SUM(trolleys_loaded), 0)
  INTO v_trolleys_loaded
  FROM delivery_runs
  WHERE haulier_id = p_haulier_id
    AND org_id = p_org_id
    AND status IN ('loading', 'in_transit', 'completed');

  -- Sum all returned trolleys from completed runs
  SELECT COALESCE(SUM(trolleys_returned), 0)
  INTO v_trolleys_returned
  FROM delivery_runs
  WHERE haulier_id = p_haulier_id
    AND org_id = p_org_id
    AND status = 'completed';

  -- Sum trolleys transferred to customers via balance transfers
  SELECT COALESCE(SUM(trolleys), 0)
  INTO v_trolleys_transferred
  FROM pending_balance_transfers
  WHERE from_haulier_id = p_haulier_id
    AND org_id = p_org_id
    AND status = 'approved';

  -- Sum shelves loaded from delivery_runs (if tracked)
  SELECT COALESCE(SUM(COALESCE(shelves_loaded, 0)), 0)
  INTO v_shelves_loaded
  FROM delivery_runs
  WHERE haulier_id = p_haulier_id
    AND org_id = p_org_id
    AND status IN ('loading', 'in_transit', 'completed');

  -- Sum shelves returned from completed runs
  SELECT COALESCE(SUM(COALESCE(shelves_returned, 0)), 0)
  INTO v_shelves_returned
  FROM delivery_runs
  WHERE haulier_id = p_haulier_id
    AND org_id = p_org_id
    AND status = 'completed';

  -- Sum shelves transferred to customers
  SELECT COALESCE(SUM(shelves), 0)
  INTO v_shelves_transferred
  FROM pending_balance_transfers
  WHERE from_haulier_id = p_haulier_id
    AND org_id = p_org_id
    AND status = 'approved';

  -- Calculate balances
  v_trolleys_balance := v_trolleys_loaded - v_trolleys_returned - v_trolleys_transferred;
  v_shelves_balance := v_shelves_loaded - v_shelves_returned - v_shelves_transferred;

  -- Get last load date
  -- Use actual_departure_time (correct column name)
  SELECT MAX(actual_departure_time)
  INTO v_last_load
  FROM delivery_runs
  WHERE haulier_id = p_haulier_id
    AND org_id = p_org_id
    AND status IN ('loading', 'in_transit', 'completed');

  -- Use actual_return_time (correct column name)
  SELECT MAX(actual_return_time)
  INTO v_last_return
  FROM delivery_runs
  WHERE haulier_id = p_haulier_id
    AND org_id = p_org_id
    AND status = 'completed';

  -- Upsert balance (ensure non-negative)
  INSERT INTO haulier_trolley_balance (
    org_id,
    haulier_id,
    trolleys_out,
    shelves_out,
    last_load_date,
    last_return_date,
    updated_at
  )
  VALUES (
    p_org_id,
    p_haulier_id,
    GREATEST(0, v_trolleys_balance),
    GREATEST(0, v_shelves_balance),
    v_last_load,
    v_last_return,
    now()
  )
  ON CONFLICT (org_id, haulier_id) DO UPDATE SET
    trolleys_out = GREATEST(0, v_trolleys_balance),
    shelves_out = GREATEST(0, v_shelves_balance),
    last_load_date = COALESCE(v_last_load, haulier_trolley_balance.last_load_date),
    last_return_date = COALESCE(v_last_return, haulier_trolley_balance.last_return_date),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_haulier_trolley_balance(uuid, uuid) IS
  'Recalculates haulier trolley AND shelf balance from delivery_runs and transfers.';

-- ================================================
-- ADD SHELF COLUMNS TO DELIVERY_RUNS IF MISSING
-- ================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_runs' AND column_name = 'shelves_loaded'
  ) THEN
    ALTER TABLE delivery_runs ADD COLUMN shelves_loaded integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_runs' AND column_name = 'shelves_returned'
  ) THEN
    ALTER TABLE delivery_runs ADD COLUMN shelves_returned integer DEFAULT 0;
  END IF;
END $$;

-- ================================================
-- RECALCULATE ALL BALANCES
-- ================================================
-- Run initial sync to fix any existing inconsistencies

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Recalculate all customer balances
  FOR r IN
    SELECT DISTINCT customer_id, org_id
    FROM equipment_movement_log
    WHERE customer_id IS NOT NULL
  LOOP
    PERFORM recalculate_customer_trolley_balance(r.customer_id, r.org_id);
  END LOOP;

  -- Recalculate all haulier balances
  FOR r IN
    SELECT DISTINCT haulier_id, org_id
    FROM delivery_runs
    WHERE haulier_id IS NOT NULL
  LOOP
    PERFORM recalculate_haulier_trolley_balance(r.haulier_id, r.org_id);
  END LOOP;
END $$;
