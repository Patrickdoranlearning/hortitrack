-- ================================================
-- SALES CRM AND TARGETING MIGRATION
-- ================================================
-- This migration creates:
-- 1. Customer Interactions table (CRM)
-- 2. Email tracking columns on orders
-- 3. Sales Admin Inbox view
-- 4. Sales Rep Targets view
-- ================================================

-- ================================================
-- 1. CUSTOMER INTERACTIONS TABLE (CRM)
-- ================================================
-- Track sales rep activities with customers

DO $$ BEGIN
  CREATE TYPE interaction_type AS ENUM ('call', 'email', 'visit', 'whatsapp', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type interaction_type NOT NULL,
  outcome text,  -- e.g. "Order Placed", "No Answer", "Fully Stocked"
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_customer_interactions_org 
  ON public.customer_interactions(org_id);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_customer 
  ON public.customer_interactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_user 
  ON public.customer_interactions(user_id);

-- Enable RLS
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_interactions' 
    AND policyname = 'Users can view interactions in their org'
  ) THEN
    CREATE POLICY "Users can view interactions in their org" 
      ON public.customer_interactions
      FOR SELECT USING (public.user_in_org(org_id));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_interactions' 
    AND policyname = 'Users can insert interactions in their org'
  ) THEN
    CREATE POLICY "Users can insert interactions in their org" 
      ON public.customer_interactions
      FOR INSERT WITH CHECK (public.user_in_org(org_id));
  END IF;
END $$;

COMMENT ON TABLE public.customer_interactions IS 'CRM: Track sales rep activities (calls, emails, visits) with customers';

-- ================================================
-- 2. EMAIL TRACKING ON ORDERS
-- ================================================
-- Track when confirmation and dispatch emails were sent

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS dispatch_email_sent_at timestamptz;

COMMENT ON COLUMN public.orders.confirmation_sent_at IS 'Timestamp when order confirmation email was sent to customer';
COMMENT ON COLUMN public.orders.dispatch_email_sent_at IS 'Timestamp when dispatch notification with invoice was sent';

-- ================================================
-- 3. SALES ADMIN INBOX VIEW
-- ================================================
-- Aggregates actionable tasks for sales admins:
-- - Webshop orders needing confirmation
-- - Orders leaving today/tomorrow needing docket/invoice

CREATE OR REPLACE VIEW v_sales_admin_inbox AS
-- SOURCE A: Webshop Orders Needing Confirmation
SELECT 
  o.id as reference_id,
  o.org_id,
  'webshop_approval'::text as task_type,
  'Webshop Order #' || o.order_number as title,
  c.name || ' submitted a new order (€' || COALESCE(round(o.total_inc_vat::numeric, 2)::text, '0') || ')' as description,
  o.created_at as task_date,
  3 as priority, -- High priority
  '/sales/orders/' || o.id as link_url,
  'Review & Confirm' as action_label,
  c.name as customer_name,
  o.order_number,
  o.total_inc_vat
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status::text = 'draft' 
  AND (o.order_number LIKE 'WEB-%' OR o.notes ILIKE '%webshop%')
  AND o.confirmation_sent_at IS NULL

UNION ALL

-- SOURCE B: Orders Scheduled for This Week (Need Dispatch Prep)
SELECT
  o.id as reference_id,
  o.org_id,
  'dispatch_prep'::text as task_type,
  'Prep for Dispatch: ' || c.name as title,
  'Order #' || o.order_number || ' - ' || 
  CASE 
    WHEN o.requested_delivery_date = current_date THEN 'TODAY'
    WHEN o.requested_delivery_date = current_date + 1 THEN 'TOMORROW'
    ELSE to_char(o.requested_delivery_date, 'Day DD Mon')
  END as description,
  o.requested_delivery_date as task_date,
  CASE 
    WHEN o.requested_delivery_date = current_date THEN 3 -- Urgent for today
    WHEN o.requested_delivery_date = current_date + 1 THEN 2 -- High for tomorrow
    ELSE 1 -- Normal for rest of week
  END as priority,
  '/sales/orders/' || o.id as link_url,
  CASE 
    WHEN o.requested_delivery_date = current_date THEN 'Dispatch Now'
    ELSE 'Print Docket'
  END as action_label,
  c.name as customer_name,
  o.order_number,
  o.total_inc_vat
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status::text IN ('confirmed', 'ready', 'picking', 'ready_for_dispatch')
  AND o.requested_delivery_date BETWEEN current_date AND (current_date + 7)

UNION ALL

-- SOURCE C: Stale Draft Orders (untouched for 3+ days)
SELECT
  o.id as reference_id,
  o.org_id,
  'stale_draft'::text as task_type,
  'Stale Draft: ' || c.name as title,
  'Order #' || o.order_number || ' created ' || 
  extract(day from (now() - o.created_at))::int || ' days ago' as description,
  o.created_at as task_date,
  1 as priority, -- Low
  '/sales/orders/' || o.id as link_url,
  'Review Draft' as action_label,
  c.name as customer_name,
  o.order_number,
  o.total_inc_vat
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status::text = 'draft'
  AND o.order_number NOT LIKE 'WEB-%'
  AND o.created_at < (now() - interval '3 days');

COMMENT ON VIEW v_sales_admin_inbox IS 'Task queue for sales admins: webshop approvals, dispatch prep (this week), stale drafts';

-- ================================================
-- 4. SALES REP TARGETS VIEW
-- ================================================
-- Identifies customers to target based on:
-- - Van-filling opportunities (same county as existing runs)
-- - Churn risk (haven't ordered in 6+ weeks)
-- - Buying pattern analysis

CREATE OR REPLACE VIEW v_sales_rep_targets AS
WITH 
-- Get last order date for each customer
last_orders AS (
  SELECT 
    customer_id, 
    MAX(created_at) as last_order_at,
    COUNT(*) as total_orders,
    AVG(total_inc_vat) as avg_order_value
  FROM orders
  WHERE status::text NOT IN ('void', 'cancelled')
  GROUP BY customer_id
),
-- Identify active delivery runs in the next 7 days by county
active_runs AS (
  SELECT 
    ca.county,
    o.requested_delivery_date,
    COUNT(DISTINCT o.id) as order_count,
    SUM(COALESCE(o.trolleys_estimated, 1)) as current_load
  FROM orders o
  JOIN customer_addresses ca ON o.ship_to_address_id = ca.id
  WHERE o.status::text IN ('confirmed', 'picking', 'ready', 'ready_for_dispatch')
    AND o.requested_delivery_date BETWEEN current_date AND (current_date + 7)
    AND ca.county IS NOT NULL
  GROUP BY ca.county, o.requested_delivery_date
),
-- Get latest interaction for each customer
last_interactions AS (
  SELECT DISTINCT ON (customer_id)
    customer_id,
    created_at as last_interaction_at,
    outcome
  FROM customer_interactions
  ORDER BY customer_id, created_at DESC
)
SELECT
  c.id as customer_id,
  c.org_id,
  c.name as customer_name,
  c.phone,
  c.email,
  ca.county,
  ca.city,
  lo.last_order_at,
  lo.total_orders,
  lo.avg_order_value,
  li.last_interaction_at,
  li.outcome as last_interaction_outcome,
  -- Determine target reason
  CASE 
    WHEN ar.county IS NOT NULL AND ar.current_load < 10 THEN 'fill_van'
    WHEN lo.last_order_at IS NULL THEN 'new_customer'
    WHEN lo.last_order_at < (now() - interval '6 weeks') THEN 'churn_risk'
    ELSE 'routine'
  END as target_reason,
  -- Context note for the sales rep
  CASE 
    WHEN ar.county IS NOT NULL AND ar.current_load < 10 
      THEN 'Van in ' || ar.county || ' on ' || to_char(ar.requested_delivery_date, 'Dy DD Mon') || 
           ' (' || ar.current_load || '/10 trolleys)'
    WHEN lo.last_order_at IS NULL 
      THEN 'New customer - no orders yet'
    WHEN lo.last_order_at < (now() - interval '6 weeks') 
      THEN 'Last order ' || extract(day from (now() - lo.last_order_at))::int || ' days ago'
    ELSE 'Regular customer - routine check-in'
  END as context_note,
  ar.requested_delivery_date as suggested_delivery_date,
  ar.current_load as van_current_load,
  -- Priority score for sorting (higher = more urgent)
  CASE 
    WHEN ar.county IS NOT NULL AND ar.current_load < 5 THEN 100  -- Van very empty
    WHEN ar.county IS NOT NULL AND ar.current_load < 10 THEN 80 -- Van has space
    WHEN lo.last_order_at < (now() - interval '8 weeks') THEN 70 -- High churn risk
    WHEN lo.last_order_at < (now() - interval '6 weeks') THEN 50 -- Moderate churn risk
    WHEN lo.last_order_at IS NULL THEN 30 -- New customer
    ELSE 10 -- Routine
  END as priority_score
FROM customers c
-- Get default shipping address for county matching
LEFT JOIN customer_addresses ca ON c.id = ca.customer_id AND ca.is_default_shipping = true
LEFT JOIN last_orders lo ON c.id = lo.customer_id
LEFT JOIN active_runs ar ON ca.county = ar.county
LEFT JOIN last_interactions li ON c.id = li.customer_id
-- Exclude customers who ordered in the last 7 days (don't pester them)
WHERE NOT EXISTS (
  SELECT 1 FROM orders recent_o 
  WHERE recent_o.customer_id = c.id 
  AND recent_o.created_at > (now() - interval '7 days')
  AND recent_o.status::text NOT IN ('void', 'cancelled')
)
-- Exclude customers contacted in the last 2 days
AND (li.last_interaction_at IS NULL OR li.last_interaction_at < (now() - interval '2 days'))
-- Only show customers with valid target reasons
AND (
  ar.county IS NOT NULL  -- Van filling opportunity
  OR lo.last_order_at IS NULL  -- New customer
  OR lo.last_order_at < (now() - interval '6 weeks')  -- Churn risk
)
ORDER BY priority_score DESC, lo.last_order_at ASC NULLS FIRST
LIMIT 50;

COMMENT ON VIEW v_sales_rep_targets IS 'Customer targeting list for sales reps: van-filling, churn prevention, new customer outreach';

-- ================================================
-- GRANT PERMISSIONS
-- ================================================
GRANT SELECT ON v_sales_admin_inbox TO authenticated;
GRANT SELECT ON v_sales_rep_targets TO authenticated;
GRANT SELECT, INSERT ON customer_interactions TO authenticated;




