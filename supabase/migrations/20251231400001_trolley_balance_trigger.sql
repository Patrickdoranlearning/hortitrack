-- Trigger to automatically update customer_trolley_balance when a delivery is completed
-- This ensures accurate tracking of outstanding trolleys per customer

-- Function to update customer_trolley_balance when delivery is completed
CREATE OR REPLACE FUNCTION update_customer_trolley_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id uuid;
  v_org_id uuid;
  v_outstanding integer;
BEGIN
  -- Only act when status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    -- Get customer_id and org_id from the order via delivery run
    SELECT o.customer_id, dr.org_id
    INTO v_customer_id, v_org_id
    FROM delivery_items di
    JOIN orders o ON o.id = di.order_id
    JOIN delivery_runs dr ON dr.id = di.delivery_run_id
    WHERE di.id = NEW.id;

    IF v_customer_id IS NOT NULL THEN
      -- Calculate outstanding: delivered minus returned
      v_outstanding := COALESCE(NEW.trolleys_delivered, 0) - COALESCE(NEW.trolleys_returned, 0);

      -- Upsert into customer_trolley_balance
      INSERT INTO customer_trolley_balance (org_id, customer_id, trolleys_out, last_delivery_date)
      VALUES (v_org_id, v_customer_id, v_outstanding, NOW())
      ON CONFLICT (org_id, customer_id)
      DO UPDATE SET
        trolleys_out = customer_trolley_balance.trolleys_out + v_outstanding,
        last_delivery_date = CASE
          WHEN v_outstanding > 0 THEN NOW()
          ELSE customer_trolley_balance.last_delivery_date
        END,
        last_return_date = CASE
          WHEN COALESCE(NEW.trolleys_returned, 0) > 0 THEN NOW()
          ELSE customer_trolley_balance.last_return_date
        END,
        updated_at = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trg_update_customer_trolley_balance ON delivery_items;

-- Create the trigger
CREATE TRIGGER trg_update_customer_trolley_balance
  AFTER UPDATE ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_trolley_balance();

-- Add comment for documentation
COMMENT ON FUNCTION update_customer_trolley_balance() IS
  'Automatically updates customer_trolley_balance when a delivery is marked as delivered. '
  'Calculates outstanding trolleys as (delivered - returned) and maintains running balance.';
