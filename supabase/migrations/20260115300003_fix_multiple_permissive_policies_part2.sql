-- Fix multiple_permissive_policies warnings - Part 2
-- Handle remaining redundant policies

-- ============================================================================
-- printers - redundant SELECT when ALL policy exists with same condition
-- ============================================================================
DROP POLICY IF EXISTS "Users can view printers in their org" ON public.printers;

-- ============================================================================
-- profiles - profiles_self_update is redundant because profiles_admin_update_org_members
-- already includes (id = auth.uid()) condition
-- ============================================================================
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

-- ============================================================================
-- invoice_items - two ALL policies with similar conditions
-- ii_rw uses: current_org_id() AND is_member_of()
-- tenant_isolation_invoice_items uses: user_in_org()
-- Keep tenant_isolation_invoice_items as it's the more standard pattern
-- ============================================================================
DROP POLICY IF EXISTS "ii_rw" ON public.invoice_items;

-- ============================================================================
-- print_agents - consolidate user and service_role policies into one
-- ============================================================================
DROP POLICY IF EXISTS "print_agents_access" ON public.print_agents;
DROP POLICY IF EXISTS "print_agents_service_access" ON public.print_agents;

CREATE POLICY "print_agents_access" ON public.print_agents
  FOR ALL USING (
    user_in_org(org_id) OR (select auth.role()) = 'service_role'
  );

-- ============================================================================
-- print_queue - consolidate user and service_role policies into one
-- ============================================================================
DROP POLICY IF EXISTS "print_queue_access" ON public.print_queue;
DROP POLICY IF EXISTS "print_queue_service_access" ON public.print_queue;

CREATE POLICY "print_queue_access" ON public.print_queue
  FOR ALL USING (
    user_in_org(org_id) OR (select auth.role()) = 'service_role'
  );

-- ============================================================================
-- sites - redundant SELECT policy when ALL policy covers same use case
-- sites_read uses standard org_memberships pattern
-- org_rw_sites uses current_org_id() + is_member_of()
-- Keep the ALL policy (covers all operations) and remove redundant SELECT
-- ============================================================================
DROP POLICY IF EXISTS "sites_read" ON public.sites;

-- ============================================================================
-- suppliers - has 3 policies: org_rw_suppliers (ALL), read suppliers (org members), read suppliers by org
-- The two SELECT policies are redundant - one uses current_org_ids(), other uses org_memberships
-- Keep org_rw_suppliers (ALL) which handles all operations for the active org
-- Also keep one SELECT for broader read access
-- ============================================================================
DROP POLICY IF EXISTS "read suppliers (org members)" ON public.suppliers;
-- Keep "read suppliers by org" for broader read access across all user orgs
