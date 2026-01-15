-- Fix security_definer_view warnings
-- Recreate views that don't have security_invoker = true set
-- These views were either created without the option or in migrations after the initial fix

-- ============================================================================
-- org_admin_check - Used for RLS policies, filters org_memberships by admin/owner role
-- ============================================================================
DROP VIEW IF EXISTS public.org_admin_check CASCADE;
CREATE VIEW public.org_admin_check
WITH (security_invoker = true)
AS
SELECT
  org_id,
  user_id,
  role
FROM public.org_memberships
WHERE role IN ('owner', 'admin');

GRANT SELECT ON public.org_admin_check TO authenticated;
GRANT SELECT ON public.org_admin_check TO service_role;

-- ============================================================================
-- v_plant_varieties - View on plant_varieties with category mapping
-- ============================================================================
DROP VIEW IF EXISTS public.v_plant_varieties CASCADE;
CREATE VIEW public.v_plant_varieties
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

GRANT SELECT ON public.v_plant_varieties TO authenticated;
GRANT SELECT ON public.v_plant_varieties TO service_role;

-- ============================================================================
-- v_batch_passport - Plant passport information for batches
-- ============================================================================
DROP VIEW IF EXISTS public.v_batch_passport CASCADE;
CREATE VIEW public.v_batch_passport
WITH (security_invoker = true)
AS
SELECT
  b.id AS batch_id,
  COALESCE(
    CONCAT_WS(' ', v.name, '(', v.genus, v.species, ')'),
    v.name
  ) AS passport_a,
  s.producer_code AS passport_b,
  s.country_code AS passport_c,
  b.batch_number AS passport_d
FROM public.batches b
LEFT JOIN public.plant_varieties v ON b.plant_variety_id = v.id
LEFT JOIN public.suppliers s ON b.supplier_id = s.id;

GRANT SELECT ON public.v_batch_passport TO authenticated;
GRANT SELECT ON public.v_batch_passport TO service_role;

-- ============================================================================
-- v_order_summary - Order summary view with customer info and totals
-- ============================================================================
DROP VIEW IF EXISTS public.v_order_summary CASCADE;
CREATE VIEW public.v_order_summary
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.org_id,
  o.order_number,
  o.status,
  o.requested_delivery_date,
  o.subtotal_ex_vat,
  o.vat_amount,
  o.total_inc_vat,
  c.name AS customer_name
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id;

GRANT SELECT ON public.v_order_summary TO authenticated;
GRANT SELECT ON public.v_order_summary TO service_role;

-- ============================================================================
-- v_invoice_summary - Invoice summary view with customer info and balance
-- ============================================================================
DROP VIEW IF EXISTS public.v_invoice_summary CASCADE;
CREATE VIEW public.v_invoice_summary
WITH (security_invoker = true)
AS
SELECT
  i.id,
  i.org_id,
  i.invoice_number,
  i.status,
  i.issue_date,
  i.due_date,
  i.subtotal_ex_vat,
  i.vat_amount,
  i.total_inc_vat,
  0::numeric AS amount_credited,
  i.total_inc_vat AS balance_due,
  c.name AS customer_name
FROM public.invoices i
LEFT JOIN public.customers c ON i.customer_id = c.id;

GRANT SELECT ON public.v_invoice_summary TO authenticated;
GRANT SELECT ON public.v_invoice_summary TO service_role;

-- ============================================================================
-- v_credit_note_summary - Credit note summary view with customer info
-- ============================================================================
DROP VIEW IF EXISTS public.v_credit_note_summary CASCADE;
CREATE VIEW public.v_credit_note_summary
WITH (security_invoker = true)
AS
SELECT
  cn.id,
  cn.org_id,
  cn.credit_number,
  cn.status,
  cn.issue_date,
  cn.subtotal_ex_vat,
  cn.vat_amount,
  cn.total_inc_vat,
  c.name AS customer_name
FROM public.credit_notes cn
LEFT JOIN public.customers c ON cn.customer_id = c.id;

GRANT SELECT ON public.v_credit_note_summary TO authenticated;
GRANT SELECT ON public.v_credit_note_summary TO service_role;

-- ============================================================================
-- v_delivery_manifest - Delivery manifest with vehicle and customer info
-- ============================================================================
DROP VIEW IF EXISTS public.v_delivery_manifest CASCADE;
CREATE VIEW public.v_delivery_manifest
WITH (security_invoker = true)
AS
SELECT
  d.id AS delivery_id,
  d.scheduled_date,
  d.status AS delivery_status,
  d.method,
  d.trolley_count,
  d.cost_estimate,
  v.name AS vehicle_name,
  o.order_number,
  c.name AS customer_name
FROM public.deliveries d
LEFT JOIN public.vehicles v ON d.vehicle_id = v.id
LEFT JOIN public.orders o ON d.order_id = o.id
LEFT JOIN public.customers c ON o.customer_id = c.id;

GRANT SELECT ON public.v_delivery_manifest TO authenticated;
GRANT SELECT ON public.v_delivery_manifest TO service_role;

-- ============================================================================
-- v_picker_feedback - Picker feedback summary view with order info
-- ============================================================================
DROP VIEW IF EXISTS public.v_picker_feedback CASCADE;
CREATE VIEW public.v_picker_feedback
WITH (security_invoker = true)
AS
SELECT
  pf.id,
  pf.org_id,
  pf.order_id,
  pf.order_item_id,
  pf.batch_id,
  pf.type,
  pf.severity,
  pf.message,
  pf.photo_urls,
  pf.resolution_status,
  pf.created_at,
  o.order_number
FROM public.picking_feedback pf
LEFT JOIN public.orders o ON pf.order_id = o.id;

GRANT SELECT ON public.v_picker_feedback TO authenticated;
GRANT SELECT ON public.v_picker_feedback TO service_role;

-- ============================================================================
-- v_substitution_requests - Substitution requests view with order info
-- ============================================================================
DROP VIEW IF EXISTS public.v_substitution_requests CASCADE;
CREATE VIEW public.v_substitution_requests
WITH (security_invoker = true)
AS
SELECT
  ois.id,
  ois.org_id,
  ois.order_id,
  ois.order_item_id,
  ois.proposed_sku_id,
  ois.requested_qty,
  ois.reason_text,
  ois.status,
  ois.requested_by,
  ois.reviewed_by,
  ois.decided_at,
  ois.applied_at,
  ois.created_at,
  o.order_number
FROM public.order_item_substitutions ois
LEFT JOIN public.orders o ON ois.order_id = o.id;

GRANT SELECT ON public.v_substitution_requests TO authenticated;
GRANT SELECT ON public.v_substitution_requests TO service_role;

-- ============================================================================
-- checklist_templates_summary - Checklist templates with item counts
-- ============================================================================
DROP VIEW IF EXISTS public.checklist_templates_summary CASCADE;
CREATE VIEW public.checklist_templates_summary
WITH (security_invoker = true)
AS
SELECT
  ct.*,
  jsonb_array_length(ct.items) AS item_count,
  p.display_name AS created_by_name
FROM public.checklist_templates ct
LEFT JOIN public.profiles p ON ct.created_by = p.id;

GRANT SELECT ON public.checklist_templates_summary TO authenticated;
GRANT SELECT ON public.checklist_templates_summary TO service_role;

-- ============================================================================
-- tasks_with_productivity - Tasks with computed productivity metrics
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
-- production_jobs_summary - Production jobs with batch stats
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
