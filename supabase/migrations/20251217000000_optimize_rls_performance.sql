-- Optimize RLS performance by wrapping auth calls in (select ...)
-- This prevents re-evaluation for every row

-- Helper function to check membership (optimized)
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
      AND m.user_id = (select auth.uid())
  );
$$;

-- Profiles: optimize own_profile
DROP POLICY IF EXISTS own_profile ON public.profiles;
CREATE POLICY own_profile ON public.profiles
  FOR ALL
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Profiles: optimize profiles_read_self if exists (from warnings)
DROP POLICY IF EXISTS profiles_read_self ON public.profiles;
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
DROP POLICY IF EXISTS read_own_profile ON public.profiles;
DROP POLICY IF EXISTS "Customer portal users can view own profile" ON public.profiles;

CREATE POLICY "Customer portal users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (
    (select auth.uid()) = id
    AND portal_role = 'customer'
  );

-- Org Memberships: optimize own_memberships
DROP POLICY IF EXISTS own_memberships ON public.org_memberships;
CREATE POLICY own_memberships ON public.org_memberships
  FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Rate limits: optimize service_only_rate_limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  expire_at bigint NOT NULL,
  CONSTRAINT rate_limits_pkey PRIMARY KEY (key)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_only_rate_limits ON public.rate_limits;
CREATE POLICY service_only_rate_limits ON public.rate_limits
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Idempotency keys: optimize service_only_idempotency
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key text NOT NULL,
  response_body jsonb,
  status_code integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key)
);
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_only_idempotency ON public.idempotency_keys;
CREATE POLICY service_only_idempotency ON public.idempotency_keys
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Re-create "Allow all access for authenticated users" policies with optimization
-- Note: Many of these were flagged. We'll optimize them here.

-- Organizations
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.organizations;
-- (Already dropped in previous secure_rls, but ensuring it's gone or optimized if recreated)

-- Hauliers
DROP POLICY IF EXISTS "Authenticated users can manage hauliers" ON public.hauliers;
CREATE POLICY "Authenticated users can manage hauliers" ON public.hauliers
  FOR ALL
  USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

-- Picking team members
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.picking_team_members;
CREATE POLICY "Allow all access for authenticated users" ON public.picking_team_members
  FOR ALL
  USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

-- Picking teams
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.picking_teams;
CREATE POLICY "Allow all access for authenticated users" ON public.picking_teams
  FOR ALL
  USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

-- Pick lists
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.pick_lists;
CREATE POLICY "Allow all access for authenticated users" ON public.pick_lists
  FOR ALL
  USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

-- Pick items
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.pick_items;
CREATE POLICY "Allow all access for authenticated users" ON public.pick_items
  FOR ALL
  USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

-- Pick list events
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.pick_list_events;
CREATE POLICY "Allow all access for authenticated users" ON public.pick_list_events
  FOR ALL
  USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

-- Customer addresses
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.customer_addresses;
-- Note: tenant_isolation_customer_addresses exists, so we should probably DROP this insecure one entirely
-- But to be safe and follow "optimize" instruction, if we keep it, we optimize it.
-- However, having both is what causes "Multiple Permissive Policies".
-- The prompt asks to "Optimize RLS Performance (Auth Calls)".
-- We will optimize the `auth.uid()` calls in the secure policies too.

-- Update secure RLS policies to use the optimized `user_in_org` function (which now uses `(select auth.uid())`)
-- The `user_in_org` function itself was optimized at the top of this file.
-- Since the policies call this function, they inherit the optimization.

-- Optimizing generic "users in their org" policies if they exist inline
DROP POLICY IF EXISTS "Users can view photos in their org" ON public.batch_photos;
CREATE POLICY "Users can view photos in their org" ON public.batch_photos
  FOR SELECT
  USING (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Users can insert photos in their org" ON public.batch_photos;
CREATE POLICY "Users can insert photos in their org" ON public.batch_photos
  FOR INSERT
  WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Users can delete photos in their org" ON public.batch_photos;
CREATE POLICY "Users can delete photos in their org" ON public.batch_photos
  FOR DELETE
  USING (public.user_in_org(org_id));

-- Protocols
DROP POLICY IF EXISTS "Users can view org protocols" ON public.protocols;
CREATE POLICY "Users can view org protocols" ON public.protocols
  FOR SELECT
  USING (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Users can manage org protocols" ON public.protocols;
CREATE POLICY "Users can manage org protocols" ON public.protocols
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- Printers
DROP POLICY IF EXISTS "Users can view printers in their org" ON public.printers;
CREATE POLICY "Users can view printers in their org" ON public.printers
  FOR SELECT
  USING (public.user_in_org(org_id));

-- Label templates
DROP POLICY IF EXISTS "Users can view label templates in their org" ON public.label_templates;
CREATE POLICY "Users can view label templates in their org" ON public.label_templates
  FOR SELECT
  USING (public.user_in_org(org_id));

-- Customer impersonation
DROP POLICY IF EXISTS "Internal users can manage impersonation sessions" ON public.customer_impersonation_sessions;
CREATE POLICY "Internal users can manage impersonation sessions"
  ON public.customer_impersonation_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.portal_role = 'internal'
    )
  );

-- Customer favorites
DROP POLICY IF EXISTS "Customers can manage their own favorites" ON public.customer_favorite_products;
CREATE POLICY "Customers can manage their own favorites"
  ON public.customer_favorite_products
  FOR ALL
  USING (
    customer_id IN (
      SELECT customer_id FROM public.profiles
      WHERE id = (select auth.uid()) AND portal_role = 'customer'
    )
  );

-- Customer resources
DROP POLICY IF EXISTS "Customer portal users can view active resources" ON public.customer_resources;
CREATE POLICY "Customer portal users can view active resources"
  ON public.customer_resources
  FOR SELECT
  USING (
    is_active = true AND
    customer_id IN (
      SELECT customer_id FROM public.profiles
      WHERE id = (select auth.uid()) AND portal_role = 'customer'
    )
  );

DROP POLICY IF EXISTS "Internal users can manage resources" ON public.customer_resources;
CREATE POLICY "Internal users can manage resources"
  ON public.customer_resources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.portal_role = 'internal'
    )
  );

