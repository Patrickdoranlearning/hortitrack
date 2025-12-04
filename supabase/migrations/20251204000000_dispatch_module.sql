-- ================================================
-- DISPATCH MODULE MIGRATION
-- ================================================
-- This migration creates tables and relationships for:
-- 1. Delivery Routes & Scheduling
-- 2. Order Packing & Dispatch
-- 3. Danish Trolley Tracking
-- 4. Customer Order Status Updates
-- ================================================

-- ================================================
-- ENUMS FOR DISPATCH MODULE
-- ================================================

-- Delivery run/route status
create type delivery_run_status as enum (
  'planned',      -- Route planned but not yet started
  'loading',      -- Orders being loaded onto vehicle
  'in_transit',   -- Driver has departed
  'completed',    -- All deliveries completed
  'cancelled'     -- Route cancelled
);

-- Individual delivery status (per order on a route)
create type delivery_item_status as enum (
  'pending',      -- Scheduled but not yet attempted
  'loading',      -- Being loaded onto vehicle
  'in_transit',   -- On the way
  'delivered',    -- Successfully delivered
  'failed',       -- Delivery attempt failed
  'rescheduled'   -- Moved to another route/date
);

-- Trolley status tracking
create type trolley_status as enum (
  'available',    -- At depot, ready for use
  'loaded',       -- Loaded onto vehicle
  'at_customer',  -- Left with customer
  'returned',     -- Returned to depot
  'damaged',      -- Needs repair
  'lost'          -- Missing/lost
);

-- Order packing status
create type packing_status as enum (
  'not_started',  -- Order not yet packed
  'in_progress',  -- Currently being packed
  'completed',    -- Fully packed and ready
  'verified'      -- Packing verified and signed off
);

-- ================================================
-- DELIVERY RUNS (Routes)
-- ================================================
-- A delivery run represents a single vehicle's route
-- containing multiple order deliveries

CREATE TABLE public.delivery_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,

  -- Route Identification
  run_number text NOT NULL,  -- e.g., "DR-2024-001"
  run_date date NOT NULL,

  -- Haulier & Vehicle
  haulier_id uuid,  -- References hauliers (Firebase collection)
  driver_name text,
  vehicle_registration text,
  vehicle_type vehicle_type,

  -- Route Planning
  planned_departure_time timestamp with time zone,
  actual_departure_time timestamp with time zone,
  estimated_return_time timestamp with time zone,
  actual_return_time timestamp with time zone,

  -- Status & Management
  status delivery_run_status NOT NULL DEFAULT 'planned',

  -- Trolley Tracking for this run
  trolleys_loaded integer NOT NULL DEFAULT 0,
  trolleys_returned integer NOT NULL DEFAULT 0,

  -- Notes & Details
  route_notes text,

  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,  -- User who created the run

  CONSTRAINT delivery_runs_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_runs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT delivery_runs_unique_run_number UNIQUE (org_id, run_number)
);

-- Index for querying runs by date and status
CREATE INDEX idx_delivery_runs_date_status ON public.delivery_runs(org_id, run_date, status);
CREATE INDEX idx_delivery_runs_haulier ON public.delivery_runs(haulier_id) WHERE haulier_id IS NOT NULL;

-- ================================================
-- DELIVERY ITEMS
-- ================================================
-- Individual deliveries within a delivery run
-- Links orders to delivery runs

CREATE TABLE public.delivery_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,

  -- Relationships
  delivery_run_id uuid NOT NULL,
  order_id uuid NOT NULL,

  -- Delivery Sequence (for route optimization)
  sequence_number integer NOT NULL,  -- Order in which deliveries are made

  -- Delivery Window
  estimated_delivery_time timestamp with time zone,
  actual_delivery_time timestamp with time zone,
  delivery_window_start time,  -- e.g., 09:00
  delivery_window_end time,    -- e.g., 11:00

  -- Status
  status delivery_item_status NOT NULL DEFAULT 'pending',

  -- Trolley Tracking (specific to this delivery)
  trolleys_delivered integer NOT NULL DEFAULT 0,
  trolleys_returned integer NOT NULL DEFAULT 0,
  trolleys_outstanding integer GENERATED ALWAYS AS (trolleys_delivered - trolleys_returned) STORED,

  -- Delivery Details
  recipient_name text,
  recipient_signature_url text,  -- URL to signature image if captured
  delivery_notes text,
  delivery_photo_url text,  -- Photo proof of delivery

  -- Failed Delivery Information
  failure_reason text,
  rescheduled_to uuid,  -- References another delivery_items record

  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT delivery_items_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT delivery_items_delivery_run_id_fkey FOREIGN KEY (delivery_run_id) REFERENCES public.delivery_runs(id) ON DELETE CASCADE,
  CONSTRAINT delivery_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT delivery_items_sequence_check CHECK (sequence_number > 0),
  CONSTRAINT delivery_items_trolleys_check CHECK (trolleys_delivered >= 0 AND trolleys_returned >= 0)
);

-- Ensure an order isn't on multiple active runs simultaneously
CREATE UNIQUE INDEX idx_delivery_items_active_order
  ON public.delivery_items(order_id)
  WHERE status IN ('pending', 'loading', 'in_transit');

CREATE INDEX idx_delivery_items_run ON public.delivery_items(delivery_run_id, sequence_number);
CREATE INDEX idx_delivery_items_order ON public.delivery_items(order_id);
CREATE INDEX idx_delivery_items_status ON public.delivery_items(org_id, status);

-- ================================================
-- ORDER PACKING
-- ================================================
-- Tracks the packing process for orders

CREATE TABLE public.order_packing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,

  -- Relationships
  order_id uuid NOT NULL,

  -- Packing Status
  status packing_status NOT NULL DEFAULT 'not_started',

  -- Packing Details
  trolleys_used integer NOT NULL DEFAULT 0,
  total_units integer,  -- Total units packed

  -- Quality Control
  verified_by uuid,  -- User who verified packing
  verified_at timestamp with time zone,

  -- Packing Notes
  packing_notes text,
  special_instructions text,

  -- Timing
  packing_started_at timestamp with time zone,
  packing_completed_at timestamp with time zone,

  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT order_packing_pkey PRIMARY KEY (id),
  CONSTRAINT order_packing_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT order_packing_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_packing_trolleys_check CHECK (trolleys_used >= 0),
  CONSTRAINT order_packing_unique_order UNIQUE (order_id)
);

CREATE INDEX idx_order_packing_status ON public.order_packing(org_id, status);
CREATE INDEX idx_order_packing_order ON public.order_packing(order_id);

-- ================================================
-- TROLLEY INVENTORY
-- ================================================
-- Master list of physical trolleys (danish trolleys)

CREATE TABLE public.trolleys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,

  -- Identification
  trolley_number text NOT NULL,  -- Physical ID/barcode on trolley
  trolley_type text DEFAULT 'danish',  -- Type of trolley (danish, CC, etc.)

  -- Current Status
  status trolley_status NOT NULL DEFAULT 'available',

  -- Current Location
  current_location text,  -- Free text for current location
  customer_id uuid,  -- If at customer, which customer
  delivery_run_id uuid,  -- If on a delivery run

  -- Condition
  condition_notes text,
  last_inspection_date date,

  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT trolleys_pkey PRIMARY KEY (id),
  CONSTRAINT trolleys_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT trolleys_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL,
  CONSTRAINT trolleys_delivery_run_id_fkey FOREIGN KEY (delivery_run_id) REFERENCES public.delivery_runs(id) ON DELETE SET NULL,
  CONSTRAINT trolleys_unique_number UNIQUE (org_id, trolley_number)
);

CREATE INDEX idx_trolleys_status ON public.trolleys(org_id, status);
CREATE INDEX idx_trolleys_customer ON public.trolleys(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_trolleys_run ON public.trolleys(delivery_run_id) WHERE delivery_run_id IS NOT NULL;

-- ================================================
-- TROLLEY TRANSACTIONS
-- ================================================
-- Audit trail of trolley movements

CREATE TABLE public.trolley_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,

  -- Relationships
  trolley_id uuid NOT NULL,
  delivery_run_id uuid,
  delivery_item_id uuid,
  customer_id uuid,

  -- Transaction Details
  transaction_type text NOT NULL,  -- 'loaded', 'delivered', 'returned', 'damaged', 'lost'
  quantity integer NOT NULL DEFAULT 1,

  -- Context
  notes text,

  -- Actor
  recorded_by uuid,  -- User who recorded this transaction

  -- Metadata
  transaction_date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT trolley_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT trolley_transactions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT trolley_transactions_trolley_id_fkey FOREIGN KEY (trolley_id) REFERENCES public.trolleys(id) ON DELETE CASCADE,
  CONSTRAINT trolley_transactions_delivery_run_id_fkey FOREIGN KEY (delivery_run_id) REFERENCES public.delivery_runs(id) ON DELETE SET NULL,
  CONSTRAINT trolley_transactions_delivery_item_id_fkey FOREIGN KEY (delivery_item_id) REFERENCES public.delivery_items(id) ON DELETE SET NULL,
  CONSTRAINT trolley_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL
);

CREATE INDEX idx_trolley_transactions_trolley ON public.trolley_transactions(trolley_id, transaction_date DESC);
CREATE INDEX idx_trolley_transactions_run ON public.trolley_transactions(delivery_run_id) WHERE delivery_run_id IS NOT NULL;
CREATE INDEX idx_trolley_transactions_customer ON public.trolley_transactions(customer_id) WHERE customer_id IS NOT NULL;

-- ================================================
-- CUSTOMER TROLLEY BALANCE
-- ================================================
-- Quick reference for trolleys outstanding per customer

CREATE TABLE public.customer_trolley_balance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  customer_id uuid NOT NULL,

  -- Balance
  trolleys_out integer NOT NULL DEFAULT 0,
  last_delivery_date date,
  last_return_date date,

  -- Reminders
  reminder_sent_at timestamp with time zone,
  reminder_count integer NOT NULL DEFAULT 0,

  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT customer_trolley_balance_pkey PRIMARY KEY (id),
  CONSTRAINT customer_trolley_balance_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT customer_trolley_balance_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
  CONSTRAINT customer_trolley_balance_unique_customer UNIQUE (org_id, customer_id),
  CONSTRAINT customer_trolley_balance_check CHECK (trolleys_out >= 0)
);

CREATE INDEX idx_customer_trolley_balance_outstanding ON public.customer_trolley_balance(org_id, trolleys_out) WHERE trolleys_out > 0;

-- ================================================
-- ORDER STATUS UPDATES (Customer-Facing)
-- ================================================
-- Timeline of status updates for customer visibility

CREATE TABLE public.order_status_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,

  -- Relationships
  order_id uuid NOT NULL,
  delivery_item_id uuid,  -- If related to a specific delivery

  -- Status Update
  status_type text NOT NULL,  -- 'order_confirmed', 'packing_started', 'packing_completed', 'out_for_delivery', 'delivered', 'delivery_delayed'
  title text NOT NULL,
  message text,

  -- Visibility
  visible_to_customer boolean NOT NULL DEFAULT true,
  customer_notified_at timestamp with time zone,

  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,

  CONSTRAINT order_status_updates_pkey PRIMARY KEY (id),
  CONSTRAINT order_status_updates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT order_status_updates_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_status_updates_delivery_item_id_fkey FOREIGN KEY (delivery_item_id) REFERENCES public.delivery_items(id) ON DELETE SET NULL
);

CREATE INDEX idx_order_status_updates_order ON public.order_status_updates(order_id, created_at DESC);
CREATE INDEX idx_order_status_updates_customer_visible ON public.order_status_updates(order_id, visible_to_customer, created_at DESC);

-- ================================================
-- UPDATED_AT TRIGGERS
-- ================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all dispatch tables
CREATE TRIGGER update_delivery_runs_updated_at BEFORE UPDATE ON public.delivery_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_items_updated_at BEFORE UPDATE ON public.delivery_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_packing_updated_at BEFORE UPDATE ON public.order_packing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trolleys_updated_at BEFORE UPDATE ON public.trolleys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_trolley_balance_updated_at BEFORE UPDATE ON public.customer_trolley_balance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- HELPFUL VIEWS
-- ================================================

-- View: Orders ready for dispatch
-- Shows orders that are ready to be packed/scheduled for delivery
CREATE VIEW v_orders_ready_for_dispatch AS
SELECT
  o.id,
  o.order_number,
  o.org_id,
  o.customer_id,
  c.name as customer_name,
  o.requested_delivery_date,
  o.total_inc_vat,
  op.status as packing_status,
  op.trolleys_used,
  COALESCE(di.status::text, 'unscheduled') as delivery_status
FROM public.orders o
LEFT JOIN public.customers c ON c.id = o.customer_id
LEFT JOIN public.order_packing op ON op.order_id = o.id
LEFT JOIN public.delivery_items di ON di.order_id = o.id AND di.status IN ('pending', 'loading', 'in_transit')
WHERE o.status::text IN ('ready_for_dispatch', 'processing', 'confirmed')
  AND o.status::text NOT IN ('dispatched', 'delivered', 'cancelled');

-- View: Active delivery runs with item counts
CREATE VIEW v_active_delivery_runs AS
SELECT
  dr.id,
  dr.run_number,
  dr.org_id,
  dr.run_date,
  dr.status,
  dr.driver_name,
  dr.vehicle_registration,
  dr.trolleys_loaded,
  dr.trolleys_returned,
  dr.trolleys_loaded - dr.trolleys_returned as trolleys_outstanding,
  COUNT(di.id) as total_deliveries,
  COUNT(di.id) FILTER (WHERE di.status = 'delivered') as completed_deliveries,
  COUNT(di.id) FILTER (WHERE di.status = 'pending') as pending_deliveries
FROM public.delivery_runs dr
LEFT JOIN public.delivery_items di ON di.delivery_run_id = dr.id
WHERE dr.status IN ('planned', 'loading', 'in_transit')
GROUP BY dr.id;

-- View: Customer trolley summary
CREATE VIEW v_customer_trolley_summary AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.org_id,
  COALESCE(ctb.trolleys_out, 0) as trolleys_outstanding,
  ctb.last_delivery_date,
  ctb.last_return_date,
  CASE
    WHEN ctb.last_delivery_date IS NOT NULL AND ctb.last_return_date IS NULL
      THEN CURRENT_DATE - ctb.last_delivery_date
    WHEN ctb.last_delivery_date > ctb.last_return_date
      THEN CURRENT_DATE - ctb.last_delivery_date
    ELSE NULL
  END as days_outstanding
FROM public.customers c
LEFT JOIN public.customer_trolley_balance ctb ON ctb.customer_id = c.id
WHERE COALESCE(ctb.trolleys_out, 0) > 0;

-- ================================================
-- RLS (Row Level Security) - to be enabled if needed
-- ================================================
-- These are commented out but can be enabled based on your security requirements

-- ALTER TABLE public.delivery_runs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.order_packing ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.trolleys ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.trolley_transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.customer_trolley_balance ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.order_status_updates ENABLE ROW LEVEL SECURITY;

-- Sample RLS Policy (adjust based on your auth setup)
-- CREATE POLICY "Users can view their org's delivery runs" ON public.delivery_runs
--   FOR SELECT
--   USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

COMMENT ON TABLE public.delivery_runs IS 'Delivery routes/runs containing multiple order deliveries';
COMMENT ON TABLE public.delivery_items IS 'Individual deliveries within a delivery run';
COMMENT ON TABLE public.order_packing IS 'Order packing status and details';
COMMENT ON TABLE public.trolleys IS 'Physical trolley inventory (danish trolleys)';
COMMENT ON TABLE public.trolley_transactions IS 'Audit trail of trolley movements';
COMMENT ON TABLE public.customer_trolley_balance IS 'Outstanding trolley count per customer';
COMMENT ON TABLE public.order_status_updates IS 'Customer-facing order status timeline';
