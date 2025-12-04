-- Strengthen tenant isolation policies and add supporting indexes

-- Remove insecure default policy
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.organizations;

-- Helper function to check membership
CREATE OR REPLACE FUNCTION public.user_in_org(target_org_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships m
    WHERE m.org_id = target_org_id
      AND m.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_in_org TO authenticated, service_role;

-- Organizations
DROP POLICY IF EXISTS tenant_isolation_orgs ON public.organizations;
CREATE POLICY tenant_isolation_orgs ON public.organizations
  FOR ALL
  USING (public.user_in_org(id))
  WITH CHECK (public.user_in_org(id));

-- Sites
DROP POLICY IF EXISTS tenant_isolation_sites ON public.sites;
CREATE POLICY tenant_isolation_sites ON public.sites
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- Nursery locations
DROP POLICY IF EXISTS tenant_isolation_locations ON public.nursery_locations;
CREATE POLICY tenant_isolation_locations ON public.nursery_locations
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- Suppliers
DROP POLICY IF EXISTS tenant_isolation_suppliers ON public.suppliers;
CREATE POLICY tenant_isolation_suppliers ON public.suppliers
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- Price lists
DROP POLICY IF EXISTS tenant_isolation_price_lists ON public.price_lists;
CREATE POLICY tenant_isolation_price_lists ON public.price_lists
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- Customers
DROP POLICY IF EXISTS tenant_isolation_customers ON public.customers;
CREATE POLICY tenant_isolation_customers ON public.customers
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- Customer addresses
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

-- Customer contacts
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

-- Batches
DROP POLICY IF EXISTS tenant_isolation_batches ON public.batches;
CREATE POLICY tenant_isolation_batches ON public.batches
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- Batch logs
DROP POLICY IF EXISTS tenant_isolation_batch_logs ON public.batch_logs;
CREATE POLICY tenant_isolation_batch_logs ON public.batch_logs
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- SKUs
DROP POLICY IF EXISTS tenant_isolation_skus ON public.skus;
CREATE POLICY tenant_isolation_skus ON public.skus
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- Orders
DROP POLICY IF EXISTS tenant_isolation_orders ON public.orders;
CREATE POLICY tenant_isolation_orders ON public.orders
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- Order items (derive org via parent order)
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

-- Invoices
DROP POLICY IF EXISTS tenant_isolation_invoices ON public.invoices;
CREATE POLICY tenant_isolation_invoices ON public.invoices
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- Invoice items (via invoice)
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

-- Profiles (self access)
DROP POLICY IF EXISTS own_profile ON public.profiles;
CREATE POLICY own_profile ON public.profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Org memberships (self visibility)
DROP POLICY IF EXISTS own_memberships ON public.org_memberships;
CREATE POLICY own_memberships ON public.org_memberships
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Rate limits (service role only)
DROP POLICY IF EXISTS service_only_rate_limits ON public.rate_limits;
CREATE POLICY service_only_rate_limits ON public.rate_limits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Idempotency keys (service role only)
DROP POLICY IF EXISTS service_only_idempotency ON public.idempotency_keys;
CREATE POLICY service_only_idempotency ON public.idempotency_keys
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Supporting indexes for permission checks
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON public.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON public.org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_batches_org_id ON public.batches(org_id);
CREATE INDEX IF NOT EXISTS idx_batch_logs_org_id ON public.batch_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_id ON public.orders(org_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_skus_org_id ON public.skus(org_id);

