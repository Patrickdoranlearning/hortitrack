-- Fix duplicate_index warnings
-- Remove duplicate indexes that provide no additional value
-- Keep the indexes with more specific/useful names

-- ============================================================================
-- batch_allocations
-- ============================================================================
-- idx_batch_allocations_batch_id is covered by batch_allocations_batch_id_idx
DROP INDEX IF EXISTS public.idx_batch_allocations_batch_id;
-- idx_batch_allocations_order_item_id is covered by batch_allocations_order_item_id_idx
DROP INDEX IF EXISTS public.idx_batch_allocations_order_item_id;

-- ============================================================================
-- batches
-- ============================================================================
-- idx_batches_org_id is covered by batches_org_id_idx
DROP INDEX IF EXISTS public.idx_batches_org_id;
-- idx_batches_plant_variety_id is covered by batches_plant_variety_id_idx
DROP INDEX IF EXISTS public.idx_batches_plant_variety_id;
-- idx_batches_size_id is covered by batches_size_id_idx
DROP INDEX IF EXISTS public.idx_batches_size_id;
-- idx_batches_status is covered by batches_status_idx
DROP INDEX IF EXISTS public.idx_batches_status;

-- ============================================================================
-- customer_addresses
-- ============================================================================
-- customer_addresses_customer_id_idx is covered by idx_customer_addresses_customer_id
DROP INDEX IF EXISTS public.customer_addresses_customer_id_idx;

-- ============================================================================
-- invoice_items
-- ============================================================================
-- invoice_items_invoice_id_idx is covered by idx_invoice_items_invoice_id
DROP INDEX IF EXISTS public.invoice_items_invoice_id_idx;

-- ============================================================================
-- nursery_locations
-- ============================================================================
-- idx_nursery_locations_org_id is covered by nursery_locations_org_id_idx
DROP INDEX IF EXISTS public.idx_nursery_locations_org_id;

-- ============================================================================
-- order_items
-- ============================================================================
-- idx_order_items_order_id is covered by order_items_order_id_idx
DROP INDEX IF EXISTS public.idx_order_items_order_id;

-- ============================================================================
-- orders
-- ============================================================================
-- idx_orders_org_id is covered by orders_org_id_idx
DROP INDEX IF EXISTS public.idx_orders_org_id;

-- ============================================================================
-- pick_items
-- ============================================================================
-- pick_items_pick_list_id_idx is covered by idx_pick_items_pick_list_id
DROP INDEX IF EXISTS public.pick_items_pick_list_id_idx;

-- ============================================================================
-- plant_varieties
-- ============================================================================
-- idx_varieties_name_trgm is covered by idx_plant_varieties_name_trgm
DROP INDEX IF EXISTS public.idx_varieties_name_trgm;
