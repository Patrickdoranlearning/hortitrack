-- Migration: Store Order Metrics for Customer Store-Level Filtering
-- Author: data-engineer
-- Date: 2026-02-04
-- Reversible: Yes
-- Plan: .claude/plans/PLAN-customer-store-level-filtering.md (Phase 1)

-- =============================================
-- PHASE 1 TASKS:
-- 1.1 Add preferences JSONB column to customer_addresses
-- 1.2 Create v_store_order_metrics view
-- 1.3 Add index on orders.ship_to_address_id
-- =============================================

-- =============================================
-- 1.1: Add preferences column to customer_addresses
-- =============================================

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.customer_addresses.preferences IS
  'Store-level preferences: delivery_notes, preferred_products, order_frequency_target, etc.';

-- =============================================
-- 1.2: Create view for store-level order metrics
-- =============================================

-- This view aggregates order metrics per customer address (store)
-- - Excludes cancelled and draft orders from metrics
-- - Handles NULL ship_to_address_id gracefully (LEFT JOIN)
-- - Returns zeros for stores with no orders
CREATE OR REPLACE VIEW public.v_store_order_metrics AS
SELECT
  ca.id AS address_id,
  ca.customer_id,
  ca.label,
  ca.store_name,
  ca.city,
  ca.county,
  COUNT(DISTINCT o.id) AS order_count,
  COALESCE(SUM(o.total_inc_vat), 0)::numeric AS total_revenue,
  COALESCE(AVG(o.total_inc_vat), 0)::numeric AS avg_order_value,
  MAX(o.created_at) AS last_order_at
FROM public.customer_addresses ca
LEFT JOIN public.orders o
  ON o.ship_to_address_id = ca.id
  AND o.status::text NOT IN ('cancelled', 'draft')
GROUP BY ca.id, ca.customer_id, ca.label, ca.store_name, ca.city, ca.county;

COMMENT ON VIEW public.v_store_order_metrics IS
  'Aggregates order metrics per customer address (store) for store-level filtering. Excludes cancelled/draft orders.';

-- =============================================
-- 1.3: Add index on orders.ship_to_address_id
-- =============================================

-- This index improves performance for:
-- - JOIN queries in v_store_order_metrics
-- - Filtering orders by ship_to_address_id in store detail views
-- - General FK lookups
CREATE INDEX IF NOT EXISTS idx_orders_ship_to_address_id
  ON public.orders (ship_to_address_id)
  WHERE ship_to_address_id IS NOT NULL;

-- =============================================
-- DOWN MIGRATION (for reference - not auto-run)
-- =============================================
-- DROP VIEW IF EXISTS public.v_store_order_metrics;
-- DROP INDEX IF EXISTS public.idx_orders_ship_to_address_id;
-- ALTER TABLE public.customer_addresses DROP COLUMN IF EXISTS preferences;
