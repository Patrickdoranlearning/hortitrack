-- ============================================================================
-- FIX: RLS Policy Performance (auth_rls_initplan warnings)
-- ============================================================================
-- This migration fixes Supabase linter performance warnings by replacing
-- `auth.uid()` with `(select auth.uid())` and `auth.role()` with
-- `(select auth.role())` in RLS policies.
--
-- Only includes tables that were flagged in the Supabase linter.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. profiles table
-- ============================================================================
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Customer portal users can view own profile" ON public.profiles;
CREATE POLICY "Customer portal users can view own profile" ON public.profiles
  FOR SELECT USING (id = (select auth.uid()));

-- ============================================================================
-- 2. tasks table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org tasks" ON public.tasks;
CREATE POLICY "Users can view org tasks" ON public.tasks
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage org tasks" ON public.tasks;
CREATE POLICY "Users can manage org tasks" ON public.tasks
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 3. production_jobs table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org production jobs" ON public.production_jobs;
CREATE POLICY "Users can view org production jobs" ON public.production_jobs
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage org production jobs" ON public.production_jobs;
CREATE POLICY "Users can manage org production jobs" ON public.production_jobs
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 4. production_job_batches table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org job batches" ON public.production_job_batches;
CREATE POLICY "Users can view org job batches" ON public.production_job_batches
  FOR SELECT USING (
    job_id IN (
      SELECT id FROM public.production_jobs
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can manage org job batches" ON public.production_job_batches;
CREATE POLICY "Users can manage org job batches" ON public.production_job_batches
  FOR ALL USING (
    job_id IN (
      SELECT id FROM public.production_jobs
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT id FROM public.production_jobs
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

-- ============================================================================
-- 5. productivity_logs table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org productivity logs" ON public.productivity_logs;
CREATE POLICY "Users can view org productivity logs" ON public.productivity_logs
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert org productivity logs" ON public.productivity_logs;
CREATE POLICY "Users can insert org productivity logs" ON public.productivity_logs
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 6. suppliers table
-- ============================================================================
DROP POLICY IF EXISTS "read suppliers by org" ON public.suppliers;
CREATE POLICY "read suppliers by org" ON public.suppliers
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "suppliers_read" ON public.suppliers;
-- Don't recreate - might be duplicate

-- ============================================================================
-- 7. sites table
-- ============================================================================
DROP POLICY IF EXISTS "sites_read" ON public.sites;
CREATE POLICY "sites_read" ON public.sites
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 8. equipment_types table (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipment_types' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "Admin write equipment_types" ON public.equipment_types;
    CREATE POLICY "Admin write equipment_types" ON public.equipment_types
      FOR ALL USING ((select auth.role()) = 'authenticated')
      WITH CHECK ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- ============================================================================
-- 9. org_memberships table
-- ============================================================================
DROP POLICY IF EXISTS "org_memberships_self_insert" ON public.org_memberships;
CREATE POLICY "org_memberships_self_insert" ON public.org_memberships
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- 10. batch_events table
-- ============================================================================
DROP POLICY IF EXISTS "batch_events_rw" ON public.batch_events;
CREATE POLICY "batch_events_rw" ON public.batch_events
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 11. hauliers table
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can manage hauliers" ON public.hauliers;
CREATE POLICY "Authenticated users can manage hauliers" ON public.hauliers
  FOR ALL USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

-- ============================================================================
-- 12. org_fees table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org fees for their org" ON public.org_fees;
CREATE POLICY "Users can view org fees for their org" ON public.org_fees
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage org fees for their org" ON public.org_fees;
CREATE POLICY "Users can manage org fees for their org" ON public.org_fees
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 13. batch_photos table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view photos in their org" ON public.batch_photos;
CREATE POLICY "Users can view photos in their org" ON public.batch_photos
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert photos in their org" ON public.batch_photos;
CREATE POLICY "Users can insert photos in their org" ON public.batch_photos
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete photos in their org" ON public.batch_photos;
CREATE POLICY "Users can delete photos in their org" ON public.batch_photos
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 14. protocols table (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'protocols' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "Users can view org protocols" ON public.protocols;
    CREATE POLICY "Users can view org protocols" ON public.protocols
      FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
      );

    DROP POLICY IF EXISTS "Users can manage org protocols" ON public.protocols;
    CREATE POLICY "Users can manage org protocols" ON public.protocols
      FOR ALL USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
      )
      WITH CHECK (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
      );
  END IF;
END $$;

-- ============================================================================
-- 15. printers table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view printers in their org" ON public.printers;
CREATE POLICY "Users can view printers in their org" ON public.printers
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can manage printers" ON public.printers;
CREATE POLICY "Admins can manage printers" ON public.printers
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 16. order_fees table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view order fees for their org orders" ON public.order_fees;
CREATE POLICY "Users can view order fees for their org orders" ON public.order_fees
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can manage order fees for their org orders" ON public.order_fees;
CREATE POLICY "Users can manage order fees for their org orders" ON public.order_fees
  FOR ALL USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

-- ============================================================================
-- 17. haulier_vehicles table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view haulier vehicles in their org" ON public.haulier_vehicles;
CREATE POLICY "Users can view haulier vehicles in their org" ON public.haulier_vehicles
  FOR SELECT USING (
    haulier_id IN (
      SELECT id FROM public.hauliers
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can insert haulier vehicles in their org" ON public.haulier_vehicles;
CREATE POLICY "Users can insert haulier vehicles in their org" ON public.haulier_vehicles
  FOR INSERT WITH CHECK (
    haulier_id IN (
      SELECT id FROM public.hauliers
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can update haulier vehicles in their org" ON public.haulier_vehicles;
CREATE POLICY "Users can update haulier vehicles in their org" ON public.haulier_vehicles
  FOR UPDATE USING (
    haulier_id IN (
      SELECT id FROM public.hauliers
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  )
  WITH CHECK (
    haulier_id IN (
      SELECT id FROM public.hauliers
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can delete haulier vehicles in their org" ON public.haulier_vehicles;
CREATE POLICY "Users can delete haulier vehicles in their org" ON public.haulier_vehicles
  FOR DELETE USING (
    haulier_id IN (
      SELECT id FROM public.hauliers
      WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
    )
  );

-- ============================================================================
-- 18. customer_impersonation_sessions table
-- ============================================================================
DROP POLICY IF EXISTS "Internal users can manage impersonation sessions" ON public.customer_impersonation_sessions;
CREATE POLICY "Internal users can manage impersonation sessions" ON public.customer_impersonation_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.portal_role = 'internal'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.portal_role = 'internal'
    )
  );

-- ============================================================================
-- 19. customer_favorite_products table
-- ============================================================================
DROP POLICY IF EXISTS "Customers can manage their own favorites" ON public.customer_favorite_products;
CREATE POLICY "Customers can manage their own favorites" ON public.customer_favorite_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.customer_id = customer_favorite_products.customer_id
        AND profiles.portal_role = 'customer'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.customer_impersonation_sessions cis
      WHERE cis.staff_user_id = (select auth.uid())
        AND cis.customer_id = customer_favorite_products.customer_id
        AND cis.ended_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.customer_id = customer_favorite_products.customer_id
        AND profiles.portal_role = 'customer'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.customer_impersonation_sessions cis
      WHERE cis.staff_user_id = (select auth.uid())
        AND cis.customer_id = customer_favorite_products.customer_id
        AND cis.ended_at IS NULL
    )
  );

-- ============================================================================
-- 20. customer_resources table
-- ============================================================================
DROP POLICY IF EXISTS "Customer portal users can view active resources" ON public.customer_resources;
CREATE POLICY "Customer portal users can view active resources" ON public.customer_resources
  FOR SELECT USING (
    is_active = true AND (select auth.role()) = 'authenticated'
  );

DROP POLICY IF EXISTS "Internal users can manage resources" ON public.customer_resources;
CREATE POLICY "Internal users can manage resources" ON public.customer_resources
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 21. ipm_products table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org ipm_products" ON public.ipm_products;
CREATE POLICY "Users can view org ipm_products" ON public.ipm_products
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage org ipm_products" ON public.ipm_products;
CREATE POLICY "Users can manage org ipm_products" ON public.ipm_products
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 22. ipm_programs table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org ipm_programs" ON public.ipm_programs;
CREATE POLICY "Users can view org ipm_programs" ON public.ipm_programs
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage org ipm_programs" ON public.ipm_programs;
CREATE POLICY "Users can manage org ipm_programs" ON public.ipm_programs
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 23. ipm_assignments table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org ipm_assignments" ON public.ipm_assignments;
CREATE POLICY "Users can view org ipm_assignments" ON public.ipm_assignments
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage org ipm_assignments" ON public.ipm_assignments;
CREATE POLICY "Users can manage org ipm_assignments" ON public.ipm_assignments
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 24. ipm_spot_treatments table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org ipm_spot_treatments" ON public.ipm_spot_treatments;
CREATE POLICY "Users can view org ipm_spot_treatments" ON public.ipm_spot_treatments
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage org ipm_spot_treatments" ON public.ipm_spot_treatments;
CREATE POLICY "Users can manage org ipm_spot_treatments" ON public.ipm_spot_treatments
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- 25. trials table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org trials" ON public.trials;
CREATE POLICY "Users can view org trials" ON public.trials
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage org trials" ON public.trials;
CREATE POLICY "Users can manage org trials" ON public.trials
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

COMMIT;
