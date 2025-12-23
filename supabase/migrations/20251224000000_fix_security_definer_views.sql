-- ============================================================================
-- FIX: Security Definer Views and RLS Disabled Tables
-- ============================================================================
-- This migration fixes Supabase linter errors:
-- 1. Security Definer Views: Recreate all views with security_invoker = true
-- 2. RLS Disabled Tables: Enable RLS on ipm_tasks, material_categories, eircode_zones
--
-- Views with security_invoker = true will use the querying user's permissions
-- instead of the view owner's permissions, respecting RLS policies.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: FIX SECURITY DEFINER VIEWS
-- ============================================================================

-- ============================================================================
-- 1. lookup_varieties (from 20250909000002_lookup_views_and_indices.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.lookup_varieties CASCADE;
CREATE VIEW public.lookup_varieties
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  family,
  genus,
  species,
  ("Category")::text AS category,
  created_at,
  updated_at
FROM public.plant_varieties;

-- ============================================================================
-- 2. lookup_sizes (from 20250909000002_lookup_views_and_indices.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.lookup_sizes CASCADE;
CREATE VIEW public.lookup_sizes
WITH (security_invoker = true)
AS
SELECT
  id, name, container_type, cell_multiple
FROM public.plant_sizes;

-- ============================================================================
-- 3. lookup_locations (from 20250909000002_lookup_views_and_indices.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.lookup_locations CASCADE;
CREATE VIEW public.lookup_locations
WITH (security_invoker = true)
AS
SELECT
  id, org_id, name, nursery_site, covered
FROM public.nursery_locations;

-- ============================================================================
-- 4. lookup_suppliers (from 20250909000002_lookup_views_and_indices.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.lookup_suppliers CASCADE;
CREATE VIEW public.lookup_suppliers
WITH (security_invoker = true)
AS
SELECT
  id, org_id, name, producer_code, country_code
FROM public.suppliers;

-- ============================================================================
-- 5. plant_varieties_compat (from 20250909000004_plant_varieties_compat.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.plant_varieties_compat CASCADE;
CREATE VIEW public.plant_varieties_compat
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  family,
  genus,
  species,
  "Category" AS category,
  colour,
  rating,
  created_at,
  updated_at
FROM public.plant_varieties;

COMMENT ON VIEW public.plant_varieties_compat
  IS 'UI-compat view exposing lower-case category from plant_varieties."Category"';

-- ============================================================================
-- 6. v_batch_search (from 20251230100001_add_behavior_to_batch_search_view.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_batch_search CASCADE;
CREATE VIEW public.v_batch_search
WITH (security_invoker = true)
AS
SELECT
  b.id,
  b.org_id,
  b.batch_number,
  b.status,
  b.phase,
  b.quantity,
  b.initial_quantity,
  b.ready_at,
  b.updated_at,
  b.created_at,
  b.location_id,
  l.name as location_name,
  b.size_id,
  sz.name as size_name,
  b.supplier_id,
  sup.name as supplier_name,
  b.plant_variety_id,
  v.name as variety_name,
  v.family,
  v.category,
  b.status_id,
  ao.behavior,
  b.saleable_quantity,
  b.sales_photo_url,
  b.grower_photo_url
FROM public.batches b
LEFT JOIN public.nursery_locations l ON l.id = b.location_id
LEFT JOIN public.plant_sizes sz ON sz.id = b.size_id
LEFT JOIN public.suppliers sup ON sup.id = b.supplier_id
LEFT JOIN public.plant_varieties v ON v.id = b.plant_variety_id
LEFT JOIN public.attribute_options ao ON ao.id = b.status_id;

COMMENT ON VIEW public.v_batch_search IS 'Lookup view combining batches with reference tables for faster UI filtering';

-- ============================================================================
-- 7. batch_logs_view (from 20251205120000_inventory_events.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.batch_logs_view CASCADE;
CREATE VIEW public.batch_logs_view
WITH (security_invoker = true)
AS
SELECT
  e.id,
  e.org_id,
  e.batch_id,
  e.type,
  coalesce(
    e.payload ->> 'notes',
    e.payload ->> 'reason',
    e.payload ->> 'note'
  ) as note,
  coalesce(
    nullif((e.payload ->> 'qty_change')::integer, 0),
    nullif((e.payload ->> 'units_dumped')::integer, 0),
    nullif((e.payload ->> 'units_moved')::integer, 0),
    nullif((e.payload ->> 'units_reserved')::integer, 0),
    (e.payload ->> 'quantity')::integer,
    0
  ) as qty_change,
  e.by_user_id as actor_id,
  e.at as occurred_at,
  e.created_at
FROM public.batch_events e;

COMMENT ON VIEW public.batch_logs_view IS
  'Legacy-compatible view that flattens batch_events JSON payloads for UI history timelines.';

-- ============================================================================
-- 8. v_available_batches (from 20251218000000_dual_batch_status.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_available_batches CASCADE;
CREATE VIEW public.v_available_batches
WITH (security_invoker = true)
AS
SELECT
    b.*,
    pv.name as variety_name,
    ps.name as size_name,
    nl.name as location_name
FROM public.batches b
LEFT JOIN public.plant_varieties pv ON b.plant_variety_id = pv.id
LEFT JOIN public.plant_sizes ps ON b.size_id = ps.id
LEFT JOIN public.nursery_locations nl ON b.location_id = nl.id
WHERE b.sales_status = 'available'
  AND b.quantity > 0
  AND b.archived_at IS NULL;

GRANT SELECT ON public.v_available_batches TO authenticated;

-- ============================================================================
-- 9. v_orders_ready_for_dispatch (from 20251204000000_dispatch_module.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_orders_ready_for_dispatch CASCADE;
CREATE VIEW public.v_orders_ready_for_dispatch
WITH (security_invoker = true)
AS
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

-- ============================================================================
-- 10. v_active_delivery_runs (from 20251204000000_dispatch_module.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_active_delivery_runs CASCADE;
CREATE VIEW public.v_active_delivery_runs
WITH (security_invoker = true)
AS
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

-- ============================================================================
-- 11. v_customer_trolley_summary (from 20251204000000_dispatch_module.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_customer_trolley_summary CASCADE;
CREATE VIEW public.v_customer_trolley_summary
WITH (security_invoker = true)
AS
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

-- ============================================================================
-- 12. v_pick_lists_detail (from 20251208100000_picking_module.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_pick_lists_detail CASCADE;
CREATE VIEW public.v_pick_lists_detail
WITH (security_invoker = true)
AS
SELECT
  pl.id,
  pl.org_id,
  pl.order_id,
  pl.assigned_team_id,
  pl.sequence,
  pl.status,
  pl.started_at,
  pl.completed_at,
  pl.notes,
  pl.created_at,
  o.order_number,
  o.status as order_status,
  o.requested_delivery_date,
  c.name as customer_name,
  pt.name as team_name,
  (SELECT COUNT(*) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as total_items,
  (SELECT COUNT(*) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id AND pi.status = 'picked') as picked_items,
  (SELECT SUM(pi.target_qty) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as total_qty,
  (SELECT SUM(pi.picked_qty) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as picked_qty
FROM public.pick_lists pl
LEFT JOIN public.orders o ON o.id = pl.order_id
LEFT JOIN public.customers c ON c.id = o.customer_id
LEFT JOIN public.picking_teams pt ON pt.id = pl.assigned_team_id;

-- ============================================================================
-- 13. v_picking_team_workload (from 20251208100000_picking_module.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_picking_team_workload CASCADE;
CREATE VIEW public.v_picking_team_workload
WITH (security_invoker = true)
AS
SELECT
  pt.id as team_id,
  pt.org_id,
  pt.name as team_name,
  COUNT(CASE WHEN pl.status = 'pending' THEN 1 END) as pending_picks,
  COUNT(CASE WHEN pl.status = 'in_progress' THEN 1 END) as in_progress_picks,
  COUNT(CASE WHEN pl.status = 'completed' AND pl.completed_at > now() - interval '24 hours' THEN 1 END) as completed_today,
  (SELECT COUNT(*) FROM public.picking_team_members ptm WHERE ptm.team_id = pt.id) as member_count
FROM public.picking_teams pt
LEFT JOIN public.pick_lists pl ON pl.assigned_team_id = pt.id
WHERE pt.is_active = true
GROUP BY pt.id, pt.org_id, pt.name;

-- ============================================================================
-- 14. v_delivery_note_header (from 20251209100000_customer_enhancement.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_delivery_note_header CASCADE;
CREATE VIEW public.v_delivery_note_header
WITH (security_invoker = true)
AS
SELECT d.id AS delivery_id,
    d.org_id,
    d.scheduled_date,
    d.status AS delivery_status,
    d.method,
    d.trolley_count,
    v.name AS vehicle_name,
    o.id AS order_id,
    o.order_number,
    c.name AS customer_name,
    ca.label AS ship_label,
    ca.line1 AS ship_line1,
    ca.line2 AS ship_line2,
    ca.city AS ship_city,
    ca.county AS ship_county,
    ca.eircode AS ship_eircode,
    ca.country_code AS ship_country
   FROM deliveries d
     JOIN orders o ON o.id = d.order_id
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN customer_addresses ca ON ca.id = o.ship_to_address_id
     LEFT JOIN vehicles v ON v.id = d.vehicle_id;

-- ============================================================================
-- 15. customer_vat_treatment (from 20251209100000_customer_enhancement.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.customer_vat_treatment CASCADE;
CREATE VIEW public.customer_vat_treatment
WITH (security_invoker = true)
AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  c.country_code,
  c.vat_number,
  c.currency,
  CASE
    WHEN c.country_code = 'IE' THEN 'standard'
    WHEN c.country_code = 'GB' AND c.vat_number IS NOT NULL THEN 'zero_rated_export'
    WHEN c.country_code = 'GB' AND c.vat_number IS NULL THEN 'standard_export'
    WHEN c.country_code = 'XI' THEN 'northern_ireland_eu'
    WHEN c.country_code = 'NL' AND c.vat_number IS NOT NULL THEN 'reverse_charge'
    WHEN c.country_code = 'NL' AND c.vat_number IS NULL THEN 'standard_export'
    ELSE 'standard'
  END AS vat_treatment,
  CASE
    WHEN c.country_code = 'IE' THEN 'Apply Irish VAT rates'
    WHEN c.country_code = 'GB' AND c.vat_number IS NOT NULL THEN 'Zero-rated B2B export to UK'
    WHEN c.country_code = 'GB' AND c.vat_number IS NULL THEN 'Export to UK (B2C)'
    WHEN c.country_code = 'XI' THEN 'Northern Ireland - EU goods rules apply'
    WHEN c.country_code = 'NL' AND c.vat_number IS NOT NULL THEN 'Reverse charge - customer accounts for VAT'
    WHEN c.country_code = 'NL' AND c.vat_number IS NULL THEN 'Export to NL (B2C)'
    ELSE 'Apply standard VAT rates'
  END AS vat_description
FROM public.customers c;

COMMENT ON VIEW public.customer_vat_treatment IS 'Lookup view for determining VAT treatment based on customer country and VAT registration';

-- ============================================================================
-- 16. v_sales_admin_inbox (from 20251212000000_sales_crm_and_targeting.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_sales_admin_inbox CASCADE;
CREATE VIEW public.v_sales_admin_inbox
WITH (security_invoker = true)
AS
-- SOURCE A: Webshop Orders Needing Confirmation
SELECT
  o.id as reference_id,
  o.org_id,
  'webshop_approval'::text as task_type,
  'Webshop Order #' || o.order_number as title,
  c.name || ' submitted a new order (€' || COALESCE(round(o.total_inc_vat::numeric, 2)::text, '0') || ')' as description,
  o.created_at as task_date,
  3 as priority,
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
    WHEN o.requested_delivery_date = current_date THEN 3
    WHEN o.requested_delivery_date = current_date + 1 THEN 2
    ELSE 1
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
  1 as priority,
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

COMMENT ON VIEW public.v_sales_admin_inbox IS 'Task queue for sales admins: webshop approvals, dispatch prep (this week), stale drafts';

-- ============================================================================
-- 17. v_sales_rep_targets (from 20251212000000_sales_crm_and_targeting.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_sales_rep_targets CASCADE;
CREATE VIEW public.v_sales_rep_targets
WITH (security_invoker = true)
AS
WITH
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
  CASE
    WHEN ar.county IS NOT NULL AND ar.current_load < 10 THEN 'fill_van'
    WHEN lo.last_order_at IS NULL THEN 'new_customer'
    WHEN lo.last_order_at < (now() - interval '6 weeks') THEN 'churn_risk'
    ELSE 'routine'
  END as target_reason,
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
  CASE
    WHEN ar.county IS NOT NULL AND ar.current_load < 5 THEN 100
    WHEN ar.county IS NOT NULL AND ar.current_load < 10 THEN 80
    WHEN lo.last_order_at < (now() - interval '8 weeks') THEN 70
    WHEN lo.last_order_at < (now() - interval '6 weeks') THEN 50
    WHEN lo.last_order_at IS NULL THEN 30
    ELSE 10
  END as priority_score
FROM customers c
LEFT JOIN customer_addresses ca ON c.id = ca.customer_id AND ca.is_default_shipping = true
LEFT JOIN last_orders lo ON c.id = lo.customer_id
LEFT JOIN active_runs ar ON ca.county = ar.county
LEFT JOIN last_interactions li ON c.id = li.customer_id
WHERE NOT EXISTS (
  SELECT 1 FROM orders recent_o
  WHERE recent_o.customer_id = c.id
  AND recent_o.created_at > (now() - interval '7 days')
  AND recent_o.status::text NOT IN ('void', 'cancelled')
)
AND (li.last_interaction_at IS NULL OR li.last_interaction_at < (now() - interval '2 days'))
AND (
  ar.county IS NOT NULL
  OR lo.last_order_at IS NULL
  OR lo.last_order_at < (now() - interval '6 weeks')
)
ORDER BY priority_score DESC, lo.last_order_at ASC NULLS FIRST
LIMIT 50;

COMMENT ON VIEW public.v_sales_rep_targets IS 'Customer targeting list for sales reps: van-filling, churn prevention, new customer outreach';

-- ============================================================================
-- 18. v_upcoming_ipm_treatments (from 20251214100000_ipm_module.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_upcoming_ipm_treatments CASCADE;
CREATE VIEW public.v_upcoming_ipm_treatments
WITH (security_invoker = true)
AS
SELECT
  st.org_id,
  'spot' as treatment_source,
  st.id as source_id,
  st.next_application_date as due_date,
  p.name as product_name,
  p.id as product_id,
  st.rate,
  st.rate_unit,
  st.method,
  st.target_type,
  st.target_batch_id,
  st.target_location_id,
  st.applications_completed + 1 as current_application,
  st.applications_total,
  st.reason as notes,
  l.name as location_name,
  b.batch_number
FROM public.ipm_spot_treatments st
JOIN public.ipm_products p ON st.product_id = p.id
LEFT JOIN public.nursery_locations l ON st.target_location_id = l.id
LEFT JOIN public.batches b ON st.target_batch_id = b.id
WHERE st.status IN ('scheduled', 'in_progress')
  AND st.next_application_date IS NOT NULL;

-- ============================================================================
-- 19. v_ipm_stock_summary (from 20251214200000_ipm_stock_tracking.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_ipm_stock_summary CASCADE;
CREATE VIEW public.v_ipm_stock_summary
WITH (security_invoker = true)
AS
SELECT
  p.id as product_id,
  p.org_id,
  p.name as product_name,
  p.target_stock_bottles,
  p.low_stock_threshold,
  p.default_bottle_volume_ml,
  COUNT(b.id) FILTER (WHERE b.status IN ('sealed', 'open')) as bottles_in_stock,
  COUNT(b.id) FILTER (WHERE b.status = 'sealed') as bottles_sealed,
  COUNT(b.id) FILTER (WHERE b.status = 'open') as bottles_open,
  COALESCE(SUM(b.remaining_ml) FILTER (WHERE b.status IN ('sealed', 'open')), 0) as total_remaining_ml,
  COUNT(b.id) FILTER (WHERE b.status IN ('sealed', 'open')) < p.low_stock_threshold as is_low_stock,
  (
    SELECT COALESCE(SUM(ABS(m.quantity_ml)), 0)
    FROM public.ipm_stock_movements m
    WHERE m.product_id = p.id
      AND m.movement_type = 'usage'
      AND m.recorded_at >= CURRENT_DATE - INTERVAL '30 days'
  ) as usage_last_30_days_ml
FROM public.ipm_products p
LEFT JOIN public.ipm_product_bottles b ON b.product_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.org_id, p.name, p.target_stock_bottles, p.low_stock_threshold, p.default_bottle_volume_ml;

COMMENT ON VIEW public.v_ipm_stock_summary IS 'Aggregated stock summary by product showing current inventory and usage trends';

-- ============================================================================
-- 20. v_trial_summary (from 20251215200000_trials_module.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_trial_summary CASCADE;
CREATE VIEW public.v_trial_summary
WITH (security_invoker = true)
AS
SELECT
  t.id,
  t.org_id,
  t.trial_number,
  t.name,
  t.status,
  t.start_date,
  t.planned_end_date,
  v.name as variety_name,
  COUNT(DISTINCT tg.id) as group_count,
  COUNT(DISTINCT ts.id) as subject_count,
  COUNT(DISTINCT tm.id) as measurement_count,
  MAX(tm.measurement_date) as last_measurement_date,
  CASE
    WHEN t.start_date IS NOT NULL THEN
      FLOOR((CURRENT_DATE - t.start_date)::numeric / 7)::int
    ELSE 0
  END as current_week,
  t.created_at
FROM public.trials t
LEFT JOIN public.plant_varieties v ON t.variety_id = v.id
LEFT JOIN public.trial_groups tg ON t.id = tg.trial_id
LEFT JOIN public.trial_subjects ts ON tg.id = ts.group_id AND ts.is_active = true
LEFT JOIN public.trial_measurements tm ON ts.id = tm.subject_id
GROUP BY t.id, t.org_id, t.trial_number, t.name, t.status, t.start_date, t.planned_end_date, v.name, t.created_at;

GRANT SELECT ON public.v_trial_summary TO authenticated;

-- ============================================================================
-- 21. v_picker_tasks (from 20251222200000_dispatch_redesign.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_picker_tasks CASCADE;
CREATE VIEW public.v_picker_tasks
WITH (security_invoker = true)
AS
SELECT
  pl.id,
  pl.org_id,
  pl.order_id,
  pl.assigned_user_id,
  pl.assigned_team_id,
  pl.sequence,
  pl.status,
  pl.qc_status,
  pl.is_partial,
  pl.merge_status,
  pl.started_at,
  pl.completed_at,
  pl.notes,
  pl.created_at,
  o.order_number,
  o.status as order_status,
  o.requested_delivery_date,
  c.name as customer_name,
  (SELECT COUNT(*) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as total_items,
  (SELECT COUNT(*) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id AND pi.status IN ('picked', 'substituted')) as picked_items,
  (SELECT SUM(pi.target_qty) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as total_qty,
  (SELECT SUM(pi.picked_qty) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as picked_qty,
  (SELECT COUNT(*) FROM public.qc_feedback qf WHERE qf.pick_list_id = pl.id AND qf.resolved_at IS NULL) as pending_feedback_count,
  (SELECT COUNT(*) FROM public.qc_feedback qf WHERE qf.pick_list_id = pl.id AND qf.picker_acknowledged_at IS NULL AND qf.picker_notified_at IS NOT NULL) as unacknowledged_feedback_count
FROM public.pick_lists pl
LEFT JOIN public.orders o ON o.id = pl.order_id
LEFT JOIN public.customers c ON c.id = o.customer_id;

COMMENT ON VIEW public.v_picker_tasks IS 'Picker task list with order details and feedback counts';

-- ============================================================================
-- 22. tasks_with_productivity (from 20251228100000_tasks_module.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.tasks_with_productivity CASCADE;
CREATE VIEW public.tasks_with_productivity
WITH (security_invoker = true)
AS
SELECT
  t.*,
  CASE
    WHEN t.completed_at IS NOT NULL AND t.started_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) / 60
    ELSE NULL
  END AS duration_minutes,
  CASE
    WHEN t.completed_at IS NOT NULL
      AND t.started_at IS NOT NULL
      AND t.plant_quantity IS NOT NULL
      AND EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) > 0
    THEN (t.plant_quantity::NUMERIC / (EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) / 60)) * 60
    ELSE NULL
  END AS plants_per_hour,
  p.display_name AS assigned_to_name,
  p.email AS assigned_to_email
FROM public.tasks t
LEFT JOIN public.profiles p ON t.assigned_to = p.id;

GRANT SELECT ON public.tasks_with_productivity TO authenticated;
GRANT SELECT ON public.tasks_with_productivity TO service_role;

-- ============================================================================
-- 23. production_jobs_summary (from 20251228100000_tasks_module.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.production_jobs_summary CASCADE;
CREATE VIEW public.production_jobs_summary
WITH (security_invoker = true)
AS
SELECT
  j.*,
  COALESCE(batch_stats.batch_count, 0) AS batch_count,
  COALESCE(batch_stats.total_plants, 0) AS total_plants,
  p.display_name AS assigned_to_name,
  p.email AS assigned_to_email,
  CASE
    WHEN j.completed_at IS NOT NULL AND j.started_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (j.completed_at - j.started_at)) / 60
    ELSE NULL
  END AS duration_minutes
FROM public.production_jobs j
LEFT JOIN public.profiles p ON j.assigned_to = p.id
LEFT JOIN (
  SELECT
    pjb.job_id,
    COUNT(*)::INT AS batch_count,
    SUM(b.quantity)::INT AS total_plants
  FROM public.production_job_batches pjb
  JOIN public.batches b ON pjb.batch_id = b.id
  GROUP BY pjb.job_id
) batch_stats ON j.id = batch_stats.job_id;

GRANT SELECT ON public.production_jobs_summary TO authenticated;
GRANT SELECT ON public.production_jobs_summary TO service_role;

-- ============================================================================
-- 24. v_smart_sales_targets (from 20251231200000_smart_targeting.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_smart_sales_targets CASCADE;
CREATE VIEW public.v_smart_sales_targets
WITH (security_invoker = true)
AS
WITH
config AS (
  SELECT
    COALESCE(
      (SELECT config_value FROM targeting_config WHERE org_id IS NULL AND config_key = 'probability_weights'),
      '{"frequency_match": 0.30, "seasonality": 0.20, "recency_urgency": 0.20, "customer_value": 0.15, "day_of_week_pattern": 0.15}'::jsonb
    ) as prob_weights,
    COALESCE(
      (SELECT config_value FROM targeting_config WHERE org_id IS NULL AND config_key = 'route_fit_weights'),
      '{"same_routing_key": 10, "adjacent_routing_key": 7, "same_county": 3, "density_bonus_per_order": 1, "density_bonus_max": 5}'::jsonb
    ) as route_weights
),
active_delivery_zones AS (
  SELECT
    UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) as routing_key,
    ca.county,
    o.org_id,
    o.requested_delivery_date,
    COUNT(DISTINCT o.id) as order_count,
    SUM(COALESCE(o.trolleys_estimated, 1)) as current_load
  FROM public.orders o
  JOIN public.customer_addresses ca ON o.ship_to_address_id = ca.id
  WHERE o.status::text IN ('confirmed', 'picking', 'ready', 'ready_for_dispatch')
    AND o.requested_delivery_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7)
  GROUP BY 1, 2, 3, 4
),
last_interactions AS (
  SELECT DISTINCT ON (customer_id)
    customer_id,
    created_at as last_interaction_at,
    outcome as last_interaction_outcome
  FROM public.customer_interactions
  ORDER BY customer_id, created_at DESC
),
customer_scores AS (
  SELECT
    c.id as customer_id,
    c.org_id,
    c.name as customer_name,
    c.phone,
    c.email,
    ca.county,
    ca.city,
    ca.eircode,
    UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) as routing_key,
    ez.lat,
    ez.lng,
    ez.zone_name,
    cop.total_orders,
    cop.total_revenue,
    cop.avg_order_value,
    cop.last_order_at,
    cop.avg_order_interval,
    cop.preferred_dow,
    cop.value_quartile,
    li.last_interaction_at,
    li.last_interaction_outcome,
    adz.requested_delivery_date as suggested_delivery_date,
    adz.current_load as van_current_load,
    adz.order_count as zone_order_count,
    CASE
      WHEN cop.total_orders IS NULL OR cop.total_orders = 0 THEN 30
      ELSE LEAST(100, GREATEST(0,
        CASE
          WHEN cop.avg_order_interval IS NULL THEN 0
          WHEN EXTRACT(EPOCH FROM (NOW() - cop.last_order_at)) / 86400.0 >= cop.avg_order_interval THEN
            ((cfg.prob_weights->>'frequency_match')::numeric * 100)
          WHEN EXTRACT(EPOCH FROM (NOW() - cop.last_order_at)) / 86400.0 >= cop.avg_order_interval * 0.8 THEN
            ((cfg.prob_weights->>'frequency_match')::numeric * 70)
          ELSE
            ((cfg.prob_weights->>'frequency_match')::numeric * 30)
        END +
        CASE
          WHEN cop.preferred_week = EXTRACT(week FROM CURRENT_DATE) THEN
            ((cfg.prob_weights->>'seasonality')::numeric * 100)
          WHEN ABS(cop.preferred_week - EXTRACT(week FROM CURRENT_DATE)) <= 2 THEN
            ((cfg.prob_weights->>'seasonality')::numeric * 50)
          ELSE 0
        END +
        CASE
          WHEN cop.last_order_at < (NOW() - INTERVAL '8 weeks') THEN
            ((cfg.prob_weights->>'recency_urgency')::numeric * 100)
          WHEN cop.last_order_at < (NOW() - INTERVAL '6 weeks') THEN
            ((cfg.prob_weights->>'recency_urgency')::numeric * 70)
          WHEN cop.last_order_at < (NOW() - INTERVAL '4 weeks') THEN
            ((cfg.prob_weights->>'recency_urgency')::numeric * 40)
          ELSE 0
        END +
        CASE cop.value_quartile
          WHEN 4 THEN ((cfg.prob_weights->>'customer_value')::numeric * 100)
          WHEN 3 THEN ((cfg.prob_weights->>'customer_value')::numeric * 70)
          WHEN 2 THEN ((cfg.prob_weights->>'customer_value')::numeric * 40)
          ELSE ((cfg.prob_weights->>'customer_value')::numeric * 20)
        END +
        CASE
          WHEN cop.preferred_dow = EXTRACT(dow FROM CURRENT_DATE) THEN
            ((cfg.prob_weights->>'day_of_week_pattern')::numeric * 100)
          WHEN ABS(cop.preferred_dow - EXTRACT(dow FROM CURRENT_DATE)) = 1 THEN
            ((cfg.prob_weights->>'day_of_week_pattern')::numeric * 50)
          ELSE 0
        END
      ))
    END as probability_score,
    CASE
      WHEN adz.routing_key IS NOT NULL AND
           UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = adz.routing_key THEN
        (cfg.route_weights->>'same_routing_key')::int +
        LEAST((cfg.route_weights->>'density_bonus_max')::int,
              adz.order_count * (cfg.route_weights->>'density_bonus_per_order')::int)
      WHEN adz.routing_key IS NOT NULL AND
           UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ANY(
             SELECT unnest(ez2.adjacent_keys) FROM eircode_zones ez2 WHERE ez2.routing_key = adz.routing_key
           ) THEN
        (cfg.route_weights->>'adjacent_routing_key')::int +
        LEAST((cfg.route_weights->>'density_bonus_max')::int,
              adz.order_count * (cfg.route_weights->>'density_bonus_per_order')::int)
      WHEN adz.county IS NOT NULL AND ca.county = adz.county THEN
        (cfg.route_weights->>'same_county')::int
      ELSE 0
    END as route_fit_score
  FROM public.customers c
  CROSS JOIN config cfg
  LEFT JOIN public.customer_addresses ca ON c.id = ca.customer_id AND ca.is_default_shipping = true
  LEFT JOIN public.eircode_zones ez ON UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ez.routing_key
  LEFT JOIN public.customer_order_patterns cop ON c.id = cop.customer_id
  LEFT JOIN active_delivery_zones adz ON (
    (UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = adz.routing_key AND c.org_id = adz.org_id)
    OR
    (UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ANY(
      SELECT unnest(ez3.adjacent_keys) FROM eircode_zones ez3 WHERE ez3.routing_key = adz.routing_key
    ) AND c.org_id = adz.org_id)
    OR
    (ca.county = adz.county AND c.org_id = adz.org_id AND ca.eircode IS NULL)
  )
  LEFT JOIN last_interactions li ON c.id = li.customer_id
)
SELECT
  cs.*,
  ROUND((cs.probability_score * 0.6) + (cs.route_fit_score * 2.5))::int as priority_score,
  CASE
    WHEN cs.route_fit_score >= 10 THEN 'route_match'
    WHEN cs.route_fit_score >= 7 THEN 'nearby_route'
    WHEN cs.probability_score >= 70 THEN 'likely_to_order'
    WHEN cs.last_order_at IS NULL THEN 'new_customer'
    WHEN cs.last_order_at < (NOW() - INTERVAL '6 weeks') THEN 'churn_risk'
    ELSE 'routine'
  END as target_reason,
  CASE
    WHEN cs.route_fit_score >= 10 THEN
      'On ' || COALESCE(cs.county, 'Unknown') || ' route ' ||
      COALESCE(to_char(cs.suggested_delivery_date, 'Dy DD Mon'), '') ||
      ' (van ' || COALESCE(cs.van_current_load::text, '?') || '/10 trolleys)' ||
      CASE WHEN cs.avg_order_interval IS NOT NULL
        THEN '. Orders every ' || ROUND(cs.avg_order_interval)::text || ' days'
        ELSE ''
      END
    WHEN cs.route_fit_score >= 7 THEN
      'Adjacent to ' || COALESCE(cs.county, 'Unknown') || ' route. ' ||
      CASE WHEN cs.value_quartile = 4 THEN 'High-value customer.'
           WHEN cs.value_quartile = 3 THEN 'Good customer.'
           ELSE ''
      END
    WHEN cs.total_orders IS NULL OR cs.total_orders = 0 THEN
      'New customer - no orders yet'
    WHEN cs.last_order_at < (NOW() - INTERVAL '6 weeks') THEN
      'Last order ' || EXTRACT(day FROM (NOW() - cs.last_order_at))::int || ' days ago - churn risk'
    WHEN cs.probability_score >= 70 THEN
      'High likelihood to order. ' ||
      CASE WHEN cs.avg_order_interval IS NOT NULL
        THEN 'Usually orders every ' || ROUND(cs.avg_order_interval)::text || ' days'
        ELSE ''
      END
    ELSE
      'Regular customer' ||
      CASE WHEN cs.avg_order_value IS NOT NULL
        THEN ' - avg order ' || ROUND(cs.avg_order_value)::text
        ELSE ''
      END
  END as context_note
FROM customer_scores cs
WHERE NOT EXISTS (
  SELECT 1 FROM public.orders recent_o
  WHERE recent_o.customer_id = cs.customer_id
  AND recent_o.created_at > (NOW() - INTERVAL '5 days')
  AND recent_o.status::text NOT IN ('cancelled', 'draft')
)
AND (cs.last_interaction_at IS NULL OR cs.last_interaction_at < (NOW() - INTERVAL '2 days'))
AND (
  cs.route_fit_score >= 3
  OR cs.probability_score >= 50
  OR cs.total_orders IS NULL
  OR cs.last_order_at < (NOW() - INTERVAL '6 weeks')
)
ORDER BY
  CASE WHEN cs.route_fit_score >= 7 THEN 0 ELSE 1 END,
  (cs.probability_score * 0.6) + (cs.route_fit_score * 2.5) DESC,
  cs.last_order_at ASC NULLS FIRST
LIMIT 100;

COMMENT ON VIEW public.v_smart_sales_targets IS 'Smart customer targeting: probabilistic ordering + route proximity';

-- ============================================================================
-- 25. v_active_delivery_zones (from 20251231200000_smart_targeting.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_active_delivery_zones CASCADE;
CREATE VIEW public.v_active_delivery_zones
WITH (security_invoker = true)
AS
SELECT
  COALESCE(UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)), 'NO_EIRCODE') as routing_key,
  ca.county,
  o.org_id,
  o.requested_delivery_date,
  COUNT(DISTINCT o.id) as order_count,
  SUM(COALESCE(o.trolleys_estimated, 1)) as total_trolleys,
  ARRAY_AGG(DISTINCT UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)))
    FILTER (WHERE ca.eircode IS NOT NULL) as routing_keys_in_zone,
  MIN(ez.lat) as lat,
  MIN(ez.lng) as lng,
  MIN(ez.zone_name) as zone_name
FROM public.orders o
JOIN public.customer_addresses ca ON o.ship_to_address_id = ca.id
LEFT JOIN public.eircode_zones ez ON UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ez.routing_key
WHERE o.status::text IN ('confirmed', 'picking', 'ready', 'ready_for_dispatch')
  AND o.requested_delivery_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7)
GROUP BY 1, 2, 3, 4
ORDER BY o.requested_delivery_date, total_trolleys DESC;

COMMENT ON VIEW public.v_active_delivery_zones IS 'Active delivery zones for the next 7 days with trolley counts';

-- ============================================================================
-- 26. v_scheduled_deliveries_map (from 20251231200000_smart_targeting.sql)
-- ============================================================================
DROP VIEW IF EXISTS public.v_scheduled_deliveries_map CASCADE;
CREATE VIEW public.v_scheduled_deliveries_map
WITH (security_invoker = true)
AS
SELECT
  o.id as order_id,
  o.org_id,
  o.order_number,
  o.requested_delivery_date,
  o.trolleys_estimated,
  c.id as customer_id,
  c.name as customer_name,
  ca.county,
  ca.city,
  ca.eircode,
  UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) as routing_key,
  ez.lat,
  ez.lng,
  ez.zone_name
FROM public.orders o
JOIN public.customers c ON o.customer_id = c.id
JOIN public.customer_addresses ca ON o.ship_to_address_id = ca.id
LEFT JOIN public.eircode_zones ez ON UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ez.routing_key
WHERE o.status::text IN ('confirmed', 'picking', 'ready', 'ready_for_dispatch')
  AND o.requested_delivery_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7);

COMMENT ON VIEW public.v_scheduled_deliveries_map IS 'Scheduled deliveries with location data for map display';

-- ============================================================================
-- PART 2: ENABLE RLS ON TABLES
-- ============================================================================

-- ============================================================================
-- 1. ipm_tasks (has org_id - needs tenant isolation)
-- ============================================================================
ALTER TABLE public.ipm_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_ipm_tasks" ON public.ipm_tasks;
CREATE POLICY "tenant_isolation_ipm_tasks" ON public.ipm_tasks
  FOR ALL USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- ============================================================================
-- 2. material_categories (reference data - read-only for all authenticated)
-- ============================================================================
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_material_categories" ON public.material_categories;
CREATE POLICY "authenticated_read_material_categories" ON public.material_categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- 3. eircode_zones (reference data - read-only for all authenticated)
-- ============================================================================
ALTER TABLE public.eircode_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_eircode_zones" ON public.eircode_zones;
CREATE POLICY "authenticated_read_eircode_zones" ON public.eircode_zones
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- RE-GRANT PERMISSIONS (in case they were affected by CASCADE drops)
-- ============================================================================
GRANT SELECT ON public.lookup_varieties TO authenticated;
GRANT SELECT ON public.lookup_sizes TO authenticated;
GRANT SELECT ON public.lookup_locations TO authenticated;
GRANT SELECT ON public.lookup_suppliers TO authenticated;
GRANT SELECT ON public.plant_varieties_compat TO authenticated;
GRANT SELECT ON public.v_batch_search TO authenticated;
GRANT SELECT ON public.batch_logs_view TO authenticated;
GRANT SELECT ON public.v_available_batches TO authenticated;
GRANT SELECT ON public.v_orders_ready_for_dispatch TO authenticated;
GRANT SELECT ON public.v_active_delivery_runs TO authenticated;
GRANT SELECT ON public.v_customer_trolley_summary TO authenticated;
GRANT SELECT ON public.v_pick_lists_detail TO authenticated;
GRANT SELECT ON public.v_picking_team_workload TO authenticated;
GRANT SELECT ON public.v_delivery_note_header TO authenticated;
GRANT SELECT ON public.customer_vat_treatment TO authenticated;
GRANT SELECT ON public.v_sales_admin_inbox TO authenticated;
GRANT SELECT ON public.v_sales_rep_targets TO authenticated;
GRANT SELECT ON public.v_upcoming_ipm_treatments TO authenticated;
GRANT SELECT ON public.v_ipm_stock_summary TO authenticated;
GRANT SELECT ON public.v_trial_summary TO authenticated;
GRANT SELECT ON public.v_picker_tasks TO authenticated;
GRANT SELECT ON public.tasks_with_productivity TO authenticated;
GRANT SELECT ON public.tasks_with_productivity TO service_role;
GRANT SELECT ON public.production_jobs_summary TO authenticated;
GRANT SELECT ON public.production_jobs_summary TO service_role;
GRANT SELECT ON public.v_smart_sales_targets TO authenticated;
GRANT SELECT ON public.v_active_delivery_zones TO authenticated;
GRANT SELECT ON public.v_scheduled_deliveries_map TO authenticated;

COMMIT;
