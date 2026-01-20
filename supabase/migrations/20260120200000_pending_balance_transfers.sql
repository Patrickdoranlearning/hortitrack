-- ================================================
-- PENDING BALANCE TRANSFERS
-- ================================================
-- This migration adds support for trolley balance transfers
-- between hauliers and customers with an approval workflow.
--
-- Use case: When a haulier (e.g., Hannon) delivers to a customer
-- but the customer doesn't give the trolleys back, the balance
-- should be transferred from the haulier to the customer after
-- manager approval.
-- ================================================

-- ================================================
-- HAULIER TROLLEY BALANCE TABLE
-- ================================================
-- Tracks trolley balances held by hauliers (similar to customer balance)

CREATE TABLE IF NOT EXISTS public.haulier_trolley_balance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  haulier_id uuid NOT NULL,

  -- Current balance
  trolleys_out integer NOT NULL DEFAULT 0,
  shelves_out integer NOT NULL DEFAULT 0,

  -- Tracking dates
  last_load_date timestamptz,
  last_return_date timestamptz,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT haulier_trolley_balance_pkey PRIMARY KEY (id),
  CONSTRAINT haulier_trolley_balance_org_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT haulier_trolley_balance_haulier_fkey FOREIGN KEY (haulier_id) REFERENCES public.hauliers(id) ON DELETE CASCADE,
  CONSTRAINT haulier_trolley_balance_unique UNIQUE (org_id, haulier_id),
  CONSTRAINT haulier_trolley_balance_non_negative CHECK (trolleys_out >= 0 AND shelves_out >= 0)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_haulier_trolley_balance_org ON public.haulier_trolley_balance(org_id);

-- ================================================
-- PENDING BALANCE TRANSFERS TABLE
-- ================================================
-- Records pending transfers that require manager approval

CREATE TYPE IF NOT EXISTS transfer_status AS ENUM (
  'pending',    -- Awaiting approval
  'approved',   -- Approved and applied
  'rejected'    -- Rejected by manager
);

-- Ensure type exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_status') THEN
    CREATE TYPE transfer_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pending_balance_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,

  -- Transfer direction: from haulier to customer
  from_haulier_id uuid NOT NULL,
  to_customer_id uuid NOT NULL,

  -- Amounts to transfer
  trolleys integer NOT NULL DEFAULT 0,
  shelves integer NOT NULL DEFAULT 0,

  -- Context
  delivery_run_id uuid,  -- The delivery run that triggered this
  delivery_item_id uuid, -- The specific delivery item
  reason text NOT NULL,  -- Why the transfer is needed
  driver_notes text,     -- Notes from driver

  -- Evidence
  signed_docket_url text, -- Photo/scan of signed docket
  photo_url text,         -- Photo evidence

  -- Status tracking
  status transfer_status NOT NULL DEFAULT 'pending',

  -- Audit trail
  requested_by uuid NOT NULL,  -- User who initiated (usually driver)
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,            -- Manager who approved/rejected
  reviewed_at timestamptz,
  review_notes text,           -- Manager's notes on decision

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pending_balance_transfers_pkey PRIMARY KEY (id),
  CONSTRAINT pending_balance_transfers_org_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT pending_balance_transfers_haulier_fkey FOREIGN KEY (from_haulier_id) REFERENCES public.hauliers(id) ON DELETE CASCADE,
  CONSTRAINT pending_balance_transfers_customer_fkey FOREIGN KEY (to_customer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
  CONSTRAINT pending_balance_transfers_run_fkey FOREIGN KEY (delivery_run_id) REFERENCES public.delivery_runs(id) ON DELETE SET NULL,
  CONSTRAINT pending_balance_transfers_item_fkey FOREIGN KEY (delivery_item_id) REFERENCES public.delivery_items(id) ON DELETE SET NULL,
  CONSTRAINT pending_balance_transfers_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pending_balance_transfers_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pending_balance_transfers_positive_qty CHECK (trolleys >= 0 AND shelves >= 0 AND (trolleys > 0 OR shelves > 0))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pending_transfers_org_status ON public.pending_balance_transfers(org_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_transfers_haulier ON public.pending_balance_transfers(from_haulier_id);
CREATE INDEX IF NOT EXISTS idx_pending_transfers_customer ON public.pending_balance_transfers(to_customer_id);
CREATE INDEX IF NOT EXISTS idx_pending_transfers_requested_at ON public.pending_balance_transfers(org_id, requested_at DESC);

-- ================================================
-- TRANSFER LOG TABLE
-- ================================================
-- Audit log of all completed transfers (approved or rejected)

CREATE TABLE IF NOT EXISTS public.balance_transfer_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,

  -- Reference to original request
  transfer_request_id uuid NOT NULL,

  -- Snapshot of transfer details at time of action
  from_haulier_id uuid NOT NULL,
  from_haulier_name text NOT NULL,
  to_customer_id uuid NOT NULL,
  to_customer_name text NOT NULL,
  trolleys integer NOT NULL,
  shelves integer NOT NULL,

  -- Action taken
  action text NOT NULL,  -- 'approved' or 'rejected'
  reason text,

  -- Who and when
  performed_by uuid NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT balance_transfer_log_pkey PRIMARY KEY (id),
  CONSTRAINT balance_transfer_log_org_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_balance_transfer_log_org ON public.balance_transfer_log(org_id, performed_at DESC);

-- ================================================
-- FUNCTION: Apply approved transfer
-- ================================================
-- When a transfer is approved, this function:
-- 1. Decrements haulier balance
-- 2. Records movement in equipment_movement_log (which triggers customer balance update)
-- 3. Updates the transfer status

CREATE OR REPLACE FUNCTION apply_balance_transfer(
  p_transfer_id uuid,
  p_reviewer_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_transfer pending_balance_transfers;
  v_haulier_name text;
  v_customer_name text;
BEGIN
  -- Get and lock the transfer record
  SELECT * INTO v_transfer
  FROM pending_balance_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF v_transfer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer not found');
  END IF;

  IF v_transfer.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer already processed');
  END IF;

  -- Get names for audit log
  SELECT name INTO v_haulier_name FROM hauliers WHERE id = v_transfer.from_haulier_id;
  SELECT name INTO v_customer_name FROM customers WHERE id = v_transfer.to_customer_id;

  -- 1. Decrement haulier balance
  UPDATE haulier_trolley_balance
  SET
    trolleys_out = GREATEST(0, trolleys_out - v_transfer.trolleys),
    shelves_out = GREATEST(0, shelves_out - v_transfer.shelves),
    updated_at = now()
  WHERE org_id = v_transfer.org_id AND haulier_id = v_transfer.from_haulier_id;

  -- 2. Record equipment movement (triggers customer balance update)
  INSERT INTO equipment_movement_log (
    org_id,
    movement_type,
    customer_id,
    trolleys,
    shelves,
    delivery_run_id,
    notes,
    signed_docket_url,
    recorded_by,
    movement_date
  ) VALUES (
    v_transfer.org_id,
    'delivered',  -- Treating as "delivered" to customer since they now hold them
    v_transfer.to_customer_id,
    v_transfer.trolleys,
    v_transfer.shelves,
    v_transfer.delivery_run_id,
    'Balance transfer from haulier: ' || COALESCE(v_haulier_name, 'Unknown') || '. ' || COALESCE(v_transfer.reason, ''),
    v_transfer.signed_docket_url,
    p_reviewer_id,
    now()
  );

  -- 3. Update transfer status
  UPDATE pending_balance_transfers
  SET
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    review_notes = p_notes,
    updated_at = now()
  WHERE id = p_transfer_id;

  -- 4. Create audit log entry
  INSERT INTO balance_transfer_log (
    org_id,
    transfer_request_id,
    from_haulier_id,
    from_haulier_name,
    to_customer_id,
    to_customer_name,
    trolleys,
    shelves,
    action,
    reason,
    performed_by
  ) VALUES (
    v_transfer.org_id,
    p_transfer_id,
    v_transfer.from_haulier_id,
    COALESCE(v_haulier_name, 'Unknown'),
    v_transfer.to_customer_id,
    COALESCE(v_customer_name, 'Unknown'),
    v_transfer.trolleys,
    v_transfer.shelves,
    'approved',
    p_notes,
    p_reviewer_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'transferId', p_transfer_id,
    'trolleys', v_transfer.trolleys,
    'shelves', v_transfer.shelves,
    'fromHaulier', v_haulier_name,
    'toCustomer', v_customer_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCTION: Reject transfer
-- ================================================

CREATE OR REPLACE FUNCTION reject_balance_transfer(
  p_transfer_id uuid,
  p_reviewer_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_transfer pending_balance_transfers;
  v_haulier_name text;
  v_customer_name text;
BEGIN
  -- Get and lock the transfer record
  SELECT * INTO v_transfer
  FROM pending_balance_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF v_transfer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer not found');
  END IF;

  IF v_transfer.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer already processed');
  END IF;

  -- Get names for audit log
  SELECT name INTO v_haulier_name FROM hauliers WHERE id = v_transfer.from_haulier_id;
  SELECT name INTO v_customer_name FROM customers WHERE id = v_transfer.to_customer_id;

  -- Update transfer status
  UPDATE pending_balance_transfers
  SET
    status = 'rejected',
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    review_notes = p_notes,
    updated_at = now()
  WHERE id = p_transfer_id;

  -- Create audit log entry
  INSERT INTO balance_transfer_log (
    org_id,
    transfer_request_id,
    from_haulier_id,
    from_haulier_name,
    to_customer_id,
    to_customer_name,
    trolleys,
    shelves,
    action,
    reason,
    performed_by
  ) VALUES (
    v_transfer.org_id,
    p_transfer_id,
    v_transfer.from_haulier_id,
    COALESCE(v_haulier_name, 'Unknown'),
    v_transfer.to_customer_id,
    COALESCE(v_customer_name, 'Unknown'),
    v_transfer.trolleys,
    v_transfer.shelves,
    'rejected',
    p_notes,
    p_reviewer_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'transferId', p_transfer_id,
    'action', 'rejected'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCTION: Update haulier balance on delivery run changes
-- ================================================
-- When trolleys are loaded onto a haulier's vehicle, increment their balance.
-- When they return to depot, decrement their balance.

CREATE OR REPLACE FUNCTION update_haulier_balance_on_run()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if haulier_id is set
  IF NEW.haulier_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- When run moves to loading/in_transit, ensure haulier balance record exists
  IF NEW.status IN ('loading', 'in_transit') AND (OLD.status IS NULL OR OLD.status = 'planned') THEN
    INSERT INTO haulier_trolley_balance (org_id, haulier_id, trolleys_out, last_load_date)
    VALUES (NEW.org_id, NEW.haulier_id, NEW.trolleys_loaded, now())
    ON CONFLICT (org_id, haulier_id) DO UPDATE SET
      trolleys_out = haulier_trolley_balance.trolleys_out + NEW.trolleys_loaded,
      last_load_date = now(),
      updated_at = now();
  END IF;

  -- When run completes, record return and decrement balance
  IF NEW.status = 'completed' AND OLD.status IN ('loading', 'in_transit') THEN
    UPDATE haulier_trolley_balance
    SET
      trolleys_out = GREATEST(0, trolleys_out - NEW.trolleys_returned),
      last_return_date = now(),
      updated_at = now()
    WHERE org_id = NEW.org_id AND haulier_id = NEW.haulier_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS trg_update_haulier_balance_on_run ON delivery_runs;
CREATE TRIGGER trg_update_haulier_balance_on_run
  AFTER INSERT OR UPDATE OF status, trolleys_loaded, trolleys_returned ON delivery_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_haulier_balance_on_run();

-- ================================================
-- RLS POLICIES
-- ================================================

ALTER TABLE public.haulier_trolley_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_balance_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_transfer_log ENABLE ROW LEVEL SECURITY;

-- Haulier balance policies (use org_memberships, not org_members)
CREATE POLICY "Org members can manage haulier balances"
  ON public.haulier_trolley_balance
  FOR ALL
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = (select auth.uid())))
  WITH CHECK (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = (select auth.uid())));

-- Pending transfers policies
CREATE POLICY "Org members can manage pending transfers"
  ON public.pending_balance_transfers
  FOR ALL
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = (select auth.uid())))
  WITH CHECK (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = (select auth.uid())));

-- Transfer log policies
CREATE POLICY "Org members can view transfer logs"
  ON public.balance_transfer_log
  FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = (select auth.uid())));

-- Service role grants
GRANT ALL ON public.haulier_trolley_balance TO service_role;
GRANT ALL ON public.pending_balance_transfers TO service_role;
GRANT ALL ON public.balance_transfer_log TO service_role;

-- Authenticated user grants
GRANT SELECT, INSERT, UPDATE ON public.haulier_trolley_balance TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pending_balance_transfers TO authenticated;
GRANT SELECT ON public.balance_transfer_log TO authenticated;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE public.haulier_trolley_balance IS 'Tracks trolley/shelf balances held by external hauliers';
COMMENT ON TABLE public.pending_balance_transfers IS 'Pending transfer requests from haulier to customer, awaiting manager approval';
COMMENT ON TABLE public.balance_transfer_log IS 'Audit log of all approved/rejected balance transfers';
COMMENT ON FUNCTION apply_balance_transfer IS 'Approves a pending transfer, moving balance from haulier to customer';
COMMENT ON FUNCTION reject_balance_transfer IS 'Rejects a pending transfer request';
