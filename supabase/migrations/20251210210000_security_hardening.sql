-- Security Hardening Migration
-- Fixes: Tables without RLS enabled

-- =============================================================================
-- PART 1: ENABLE RLS ON TABLES WITHOUT IT
-- =============================================================================

-- Equipment Types (global reference data - no org_id)
ALTER TABLE public.equipment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global read equipment_types" ON public.equipment_types
  FOR SELECT
  USING (true);

CREATE POLICY "Admin write equipment_types" ON public.equipment_types
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.portal_role = 'internal'
    )
  );

GRANT SELECT ON public.equipment_types TO authenticated;
GRANT ALL ON public.equipment_types TO service_role;

-- Order Status Updates (has org_id)
ALTER TABLE public.order_status_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_order_status_updates ON public.order_status_updates
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_status_updates TO authenticated;

-- Order Packing (has org_id)
ALTER TABLE public.order_packing ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_order_packing ON public.order_packing
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_packing TO authenticated;

-- Trolleys (has org_id)
ALTER TABLE public.trolleys ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_trolleys ON public.trolleys
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trolleys TO authenticated;

-- Trolley Transactions (has org_id)
ALTER TABLE public.trolley_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_trolley_transactions ON public.trolley_transactions
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trolley_transactions TO authenticated;

-- Customer Trolley Balance (has org_id)
ALTER TABLE public.customer_trolley_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_customer_trolley_balance ON public.customer_trolley_balance
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_trolley_balance TO authenticated;

-- =============================================================================
-- PART 2: CREATE INDEXES FOR RLS PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_order_status_updates_org_id ON public.order_status_updates(org_id);
CREATE INDEX IF NOT EXISTS idx_order_packing_org_id ON public.order_packing(org_id);
CREATE INDEX IF NOT EXISTS idx_trolleys_org_id ON public.trolleys(org_id);
CREATE INDEX IF NOT EXISTS idx_trolley_transactions_org_id ON public.trolley_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_customer_trolley_balance_org_id ON public.customer_trolley_balance(org_id);

-- =============================================================================
-- PART 3: FIX FUNCTION SEARCH PATHS (Most Critical Ones)
-- =============================================================================

-- user_in_org - already has SET search_path, but let's ensure it's correct
CREATE OR REPLACE FUNCTION public.user_in_org(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships m
    WHERE m.org_id = target_org_id
      AND m.user_id = (SELECT auth.uid())
  );
$$;

-- is_member_of - fix search_path
CREATE OR REPLACE FUNCTION public.is_member_of(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships m
    WHERE m.user_id = auth.uid() 
      AND m.org_id = _org
  );
$$;

-- current_org_id - fix search_path
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT active_org_id FROM public.profiles WHERE id = auth.uid();
$$;

-- current_user_id - fix search_path
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid();
$$;
