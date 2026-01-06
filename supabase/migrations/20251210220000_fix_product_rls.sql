-- Fix overly permissive RLS policies on product-related and other tables
-- These tables have "Allow all access for authenticated users" with USING(true) 
-- which bypasses org isolation

-- =============================================================================
-- PRODUCTS - Replace overly permissive policy with tenant isolation
-- =============================================================================
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.products;

CREATE POLICY tenant_isolation_products ON public.products
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- SKUS - Remove overly permissive policy (org_rw_skus already exists but uses current_org_id)
-- =============================================================================
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.skus;
DROP POLICY IF EXISTS org_rw_skus ON public.skus;

CREATE POLICY tenant_isolation_skus ON public.skus
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- PRICE_LISTS - Remove overly permissive policy
-- =============================================================================
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.price_lists;
DROP POLICY IF EXISTS org_rw_price_lists ON public.price_lists;

CREATE POLICY tenant_isolation_price_lists ON public.price_lists
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- PRICE_LIST_CUSTOMERS - Replace overly permissive policy
-- =============================================================================
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.price_list_customers;

CREATE POLICY tenant_isolation_price_list_customers ON public.price_list_customers
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- PRICE_LIST_ITEMS - Keep existing pli_rw but ensure it uses user_in_org
-- =============================================================================
DROP POLICY IF EXISTS pli_rw ON public.price_list_items;

CREATE POLICY tenant_isolation_price_list_items ON public.price_list_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.price_lists pl
      WHERE pl.id = price_list_items.price_list_id
        AND public.user_in_org(pl.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.price_lists pl
      WHERE pl.id = price_list_items.price_list_id
        AND public.user_in_org(pl.org_id)
    )
  );

-- =============================================================================
-- PRODUCT_PRICES - Replace overly permissive policy
-- =============================================================================
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.product_prices;

CREATE POLICY tenant_isolation_product_prices ON public.product_prices
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- PRODUCT_BATCHES - Replace overly permissive policy
-- =============================================================================
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.product_batches;

CREATE POLICY tenant_isolation_product_batches ON public.product_batches
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- PRODUCT_ALIASES - Replace overly permissive policy
-- =============================================================================
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.product_aliases;

CREATE POLICY tenant_isolation_product_aliases ON public.product_aliases
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- ORDER_EVENTS - Replace overly permissive policy (has org_id)
-- =============================================================================
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.order_events;

CREATE POLICY tenant_isolation_order_events ON public.order_events
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- ORDER_EXCEPTIONS - Replace overly permissive policy (has org_id)
-- =============================================================================
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.order_exceptions;

CREATE POLICY tenant_isolation_order_exceptions ON public.order_exceptions
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- DISPATCH_EVENTS - Fix overly permissive policies
-- Note: dispatch_events may not have org_id - check and handle appropriately
-- =============================================================================
-- First check if it has org_id, if so add proper policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dispatch_events' AND column_name = 'org_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.dispatch_events';
    EXECUTE 'DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.dispatch_events';
    EXECUTE 'DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.dispatch_events';
    EXECUTE 'CREATE POLICY tenant_isolation_dispatch_events ON public.dispatch_events
      FOR ALL
      USING (public.user_in_org(org_id))
      WITH CHECK (public.user_in_org(org_id))';
  END IF;
END $$;

-- =============================================================================
-- PICK_ORDERS - Fix overly permissive policies (likely needs join to pick_lists)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pick_orders' AND column_name = 'org_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.pick_orders';
    EXECUTE 'DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.pick_orders';
    EXECUTE 'DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.pick_orders';
    EXECUTE 'CREATE POLICY tenant_isolation_pick_orders ON public.pick_orders
      FOR ALL
      USING (public.user_in_org(org_id))
      WITH CHECK (public.user_in_org(org_id))';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pick_orders' AND column_name = 'pick_list_id'
  ) THEN
    -- Derive org from pick_list
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.pick_orders';
    EXECUTE 'DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.pick_orders';
    EXECUTE 'DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.pick_orders';
    EXECUTE 'CREATE POLICY tenant_isolation_pick_orders ON public.pick_orders
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.pick_lists pl
          WHERE pl.id = pick_orders.pick_list_id
            AND public.user_in_org(pl.org_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.pick_lists pl
          WHERE pl.id = pick_orders.pick_list_id
            AND public.user_in_org(pl.org_id)
        )
      )';
  END IF;
END $$;

-- =============================================================================
-- SALES_QC - Fix overly permissive policies
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_qc' AND column_name = 'org_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.sales_qc';
    EXECUTE 'DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.sales_qc';
    EXECUTE 'DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.sales_qc';
    EXECUTE 'CREATE POLICY tenant_isolation_sales_qc ON public.sales_qc
      FOR ALL
      USING (public.user_in_org(org_id))
      WITH CHECK (public.user_in_org(org_id))';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_qc' AND column_name = 'order_id'
  ) THEN
    -- Derive org from order
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.sales_qc';
    EXECUTE 'DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.sales_qc';
    EXECUTE 'DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.sales_qc';
    EXECUTE 'CREATE POLICY tenant_isolation_sales_qc ON public.sales_qc
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = sales_qc.order_id
            AND public.user_in_org(o.org_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = sales_qc.order_id
            AND public.user_in_org(o.org_id)
        )
      )';
  END IF;
END $$;

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(org_id);
CREATE INDEX IF NOT EXISTS idx_skus_org_id ON public.skus(org_id);
CREATE INDEX IF NOT EXISTS idx_price_lists_org_id ON public.price_lists(org_id);
CREATE INDEX IF NOT EXISTS idx_price_list_customers_org_id ON public.price_list_customers(org_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_org_id ON public.product_prices(org_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_org_id ON public.product_batches(org_id);
CREATE INDEX IF NOT EXISTS idx_product_aliases_org_id ON public.product_aliases(org_id);
CREATE INDEX IF NOT EXISTS idx_order_events_org_id ON public.order_events(org_id);
CREATE INDEX IF NOT EXISTS idx_order_exceptions_org_id ON public.order_exceptions(org_id);

-- =============================================================================
-- GRANTS
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skus TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_prices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_aliases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_exceptions TO authenticated;




