-- =============================================================================
-- SCHEMA FIXES AND OPTIMIZATIONS
-- Based on architectural review recommendations
-- =============================================================================

-- =============================================================================
-- 1. PLANT_VARIETIES: Fix duplicate category column handling
-- =============================================================================
-- The table may have both "Category" (quoted, mixed-case from legacy) and
-- "category" (lowercase). Ensure we're using lowercase consistently.

-- First, check if the mixed-case column exists and migrate data if needed
DO $$
BEGIN
  -- If the quoted "Category" column exists but lowercase "category" doesn't have data
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plant_varieties'
      AND column_name = 'Category'
  ) THEN
    -- Migrate data from "Category" to category if category exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'plant_varieties'
        AND column_name = 'category'
    ) THEN
      -- Copy data from "Category" to category where category is null
      UPDATE public.plant_varieties
      SET category = "Category"::text
      WHERE category IS NULL AND "Category" IS NOT NULL;
    END IF;

    -- Drop the mixed-case column (will fail silently if it doesn't exist or is in use)
    BEGIN
      ALTER TABLE public.plant_varieties DROP COLUMN IF EXISTS "Category";
    EXCEPTION
      WHEN dependent_objects_still_exist THEN
        -- Column is still used by views, leave it
        RAISE NOTICE 'Cannot drop Category column due to dependent objects';
      WHEN others THEN
        RAISE NOTICE 'Error dropping Category column: %', SQLERRM;
    END;
  END IF;
END $$;

-- =============================================================================
-- 2. BATCHES: Add deprecation comments for legacy status column
-- =============================================================================
-- The status_id column is now authoritative. The text status column is kept
-- for backward compatibility but should not be used for new queries.

COMMENT ON COLUMN public.batches.status IS
  'DEPRECATED: Use status_id instead. This column is kept for backward compatibility only.
   It may be removed in a future migration. Always query through status_id FK to attribute_options.';

-- =============================================================================
-- 3. MISSING FOREIGN KEY INDEXES
-- =============================================================================
-- These indexes are critical for RLS performance and JOIN operations

-- batch_allocations indexes
CREATE INDEX IF NOT EXISTS idx_batch_allocations_batch_id
  ON public.batch_allocations(batch_id);

CREATE INDEX IF NOT EXISTS idx_batch_allocations_order_item_id
  ON public.batch_allocations(order_item_id);

CREATE INDEX IF NOT EXISTS idx_batch_allocations_org_id
  ON public.batch_allocations(org_id);

-- Additional FK indexes that may be missing
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON public.invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_sku_id
  ON public.invoice_items(sku_id) WHERE sku_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id
  ON public.invoices(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id
  ON public.customer_addresses(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id
  ON public.customer_contacts(customer_id);

CREATE INDEX IF NOT EXISTS idx_batch_logs_batch_id
  ON public.batch_logs(batch_id);

CREATE INDEX IF NOT EXISTS idx_skus_plant_variety_id
  ON public.skus(plant_variety_id);

CREATE INDEX IF NOT EXISTS idx_skus_size_id
  ON public.skus(size_id);

CREATE INDEX IF NOT EXISTS idx_skus_org_id
  ON public.skus(org_id);

-- Delivery module FK indexes
CREATE INDEX IF NOT EXISTS idx_delivery_items_org_id
  ON public.delivery_items(org_id);

CREATE INDEX IF NOT EXISTS idx_delivery_runs_org_id
  ON public.delivery_runs(org_id);

-- =============================================================================
-- 4. PRODUCT_MAPPING_RULES: Add composite index for matching queries
-- =============================================================================
-- This index optimizes availability queries for the webshop that need to
-- match batches against product rules based on family, genus, size, category

CREATE INDEX IF NOT EXISTS idx_product_mapping_rules_matching
  ON public.product_mapping_rules(
    org_id,
    is_active,
    match_family,
    match_genus,
    match_size_id
  )
  WHERE is_active = true;

-- Additional index for category + age-based matching
CREATE INDEX IF NOT EXISTS idx_product_mapping_rules_category_age
  ON public.product_mapping_rules(
    org_id,
    match_category,
    min_age_weeks,
    max_age_weeks
  )
  WHERE is_active = true;

-- =============================================================================
-- 5. CUSTOMER_TROLLEY_BALANCE: Add trigger for automatic balance updates
-- =============================================================================
-- This trigger keeps customer_trolley_balance in sync with trolley_transactions

CREATE OR REPLACE FUNCTION public.update_customer_trolley_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty_change integer;
  v_is_outbound boolean;
BEGIN
  -- Determine if this is an outbound or return transaction
  v_is_outbound := NEW.transaction_type IN ('loaded', 'delivered');

  -- Calculate quantity change (positive for outbound, negative for returns)
  IF v_is_outbound THEN
    v_qty_change := NEW.quantity;
  ELSIF NEW.transaction_type = 'returned' THEN
    v_qty_change := -NEW.quantity;
  ELSE
    -- For damaged/lost, no balance change (handled separately)
    RETURN NEW;
  END IF;

  -- Only update if there's a customer associated
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.customer_trolley_balance (
      org_id,
      customer_id,
      trolleys_out,
      last_delivery_date,
      last_return_date
    )
    VALUES (
      NEW.org_id,
      NEW.customer_id,
      GREATEST(0, v_qty_change),
      CASE WHEN v_is_outbound THEN CURRENT_DATE ELSE NULL END,
      CASE WHEN NOT v_is_outbound THEN CURRENT_DATE ELSE NULL END
    )
    ON CONFLICT (org_id, customer_id)
    DO UPDATE SET
      trolleys_out = GREATEST(0, customer_trolley_balance.trolleys_out + v_qty_change),
      last_delivery_date = CASE
        WHEN v_is_outbound THEN CURRENT_DATE
        ELSE customer_trolley_balance.last_delivery_date
      END,
      last_return_date = CASE
        WHEN NOT v_is_outbound THEN CURRENT_DATE
        ELSE customer_trolley_balance.last_return_date
      END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger (drop first if exists to allow re-running)
DROP TRIGGER IF EXISTS trg_update_customer_trolley_balance ON public.trolley_transactions;

CREATE TRIGGER trg_update_customer_trolley_balance
AFTER INSERT ON public.trolley_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_trolley_balance();

COMMENT ON FUNCTION public.update_customer_trolley_balance() IS
  'Automatically updates customer_trolley_balance when trolley_transactions are inserted.
   Tracks trolleys out, last delivery date, and last return date per customer.';

-- =============================================================================
-- 6. LOG_HISTORY: Add deprecation notice (data migration to batch_events)
-- =============================================================================
-- The log_history JSONB column is an anti-pattern. Add a comment and create
-- a helper function to migrate existing data to batch_events.

COMMENT ON COLUMN public.batches.log_history IS
  'DEPRECATED: Use batch_events table instead. This JSONB array is an anti-pattern
   for performance reasons. New log entries should use batch_events exclusively.
   This column will be removed in a future migration after data is migrated.';

-- Function to migrate log_history entries to batch_events (run manually if needed)
CREATE OR REPLACE FUNCTION public.migrate_log_history_to_events(p_batch_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch record;
  v_log jsonb;
  v_count integer := 0;
BEGIN
  FOR v_batch IN
    SELECT id, org_id, log_history
    FROM public.batches
    WHERE jsonb_array_length(log_history) > 0
      AND (p_batch_id IS NULL OR id = p_batch_id)
  LOOP
    FOR v_log IN SELECT * FROM jsonb_array_elements(v_batch.log_history)
    LOOP
      -- Insert into batch_events if not already present (based on timestamp match)
      INSERT INTO public.batch_events (
        org_id,
        batch_id,
        type,
        payload,
        at,
        created_at
      )
      SELECT
        v_batch.org_id,
        v_batch.id,
        COALESCE(v_log->>'type', 'legacy_log'),
        v_log,
        COALESCE(
          (v_log->>'occurred_at')::timestamptz,
          (v_log->>'timestamp')::timestamptz,
          (v_log->>'date')::timestamptz,
          now()
        ),
        now()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.batch_events be
        WHERE be.batch_id = v_batch.id
          AND be.type = COALESCE(v_log->>'type', 'legacy_log')
          AND be.at = COALESCE(
            (v_log->>'occurred_at')::timestamptz,
            (v_log->>'timestamp')::timestamptz,
            (v_log->>'date')::timestamptz,
            now()
          )
      );

      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.migrate_log_history_to_events IS
  'Migrates log_history JSONB entries to the batch_events table.
   Call with no arguments to migrate all, or pass a batch_id to migrate one.
   Safe to run multiple times - uses deduplication.';

-- =============================================================================
-- 7. ADDITIONAL PERFORMANCE INDEXES
-- =============================================================================

-- Index for common batch queries filtering by status + quantity
CREATE INDEX IF NOT EXISTS idx_batches_available_stock
  ON public.batches(org_id, sales_status, quantity)
  WHERE quantity > 0 AND archived_at IS NULL;

-- Index for order queries by date range
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders(org_id, created_at DESC);

-- Index for finding pending orders
CREATE INDEX IF NOT EXISTS idx_orders_pending_status
  ON public.orders(org_id, status, requested_delivery_date)
  WHERE status NOT IN ('dispatched', 'delivered', 'cancelled');

-- Composite index for batch_events queries
CREATE INDEX IF NOT EXISTS idx_batch_events_batch_type
  ON public.batch_events(batch_id, type, at DESC);

-- =============================================================================
-- GRANTS
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.update_customer_trolley_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_log_history_to_events(uuid) TO authenticated;
