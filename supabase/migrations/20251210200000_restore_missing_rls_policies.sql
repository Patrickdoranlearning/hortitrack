-- Restore missing RLS policies for critical tables
-- These policies were dropped by consolidate_policies migration but never recreated
-- because the secure_rls migration was never applied

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_orgs ON public.organizations;
CREATE POLICY tenant_isolation_orgs ON public.organizations
  FOR ALL
  USING (public.user_in_org(id))
  WITH CHECK (public.user_in_org(id));

-- =============================================================================
-- CUSTOMERS
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_customers ON public.customers;
CREATE POLICY tenant_isolation_customers ON public.customers
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- CUSTOMER ADDRESSES (derive org from parent customer)
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_customer_addresses ON public.customer_addresses;
CREATE POLICY tenant_isolation_customer_addresses ON public.customer_addresses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_addresses.customer_id
        AND public.user_in_org(c.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_addresses.customer_id
        AND public.user_in_org(c.org_id)
    )
  );

-- =============================================================================
-- CUSTOMER CONTACTS (derive org from parent customer)
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_customer_contacts ON public.customer_contacts;
CREATE POLICY tenant_isolation_customer_contacts ON public.customer_contacts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_contacts.customer_id
        AND public.user_in_org(c.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_contacts.customer_id
        AND public.user_in_org(c.org_id)
    )
  );

-- =============================================================================
-- NURSERY LOCATIONS
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_locations ON public.nursery_locations;
CREATE POLICY tenant_isolation_locations ON public.nursery_locations
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- ORDERS
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_orders ON public.orders;
CREATE POLICY tenant_isolation_orders ON public.orders
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- ORDER ITEMS (derive org from parent order)
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_order_items ON public.order_items;
CREATE POLICY tenant_isolation_order_items ON public.order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.user_in_org(o.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.user_in_org(o.org_id)
    )
  );

-- =============================================================================
-- INVOICES
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_invoices ON public.invoices;
CREATE POLICY tenant_isolation_invoices ON public.invoices
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- =============================================================================
-- INVOICE ITEMS (derive org from parent invoice) - ensure policy exists
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_invoice_items ON public.invoice_items;
CREATE POLICY tenant_isolation_invoice_items ON public.invoice_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.user_in_org(i.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.user_in_org(i.org_id)
    )
  );

-- =============================================================================
-- Supporting indexes for RLS performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_customers_org_id ON public.customers(org_id);
CREATE INDEX IF NOT EXISTS idx_nursery_locations_org_id ON public.nursery_locations(org_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON public.customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON public.customer_contacts(customer_id);

-- =============================================================================
-- Grant necessary permissions to authenticated users
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nursery_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
