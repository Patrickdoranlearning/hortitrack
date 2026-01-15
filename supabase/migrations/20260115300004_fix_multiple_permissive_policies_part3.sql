-- Fix multiple_permissive_policies warnings - Part 3
-- Handle remaining cases that can be safely consolidated

-- ============================================================================
-- batch_events - remove redundant SELECT policy
-- batch_events_rw (ALL) covers all operations including SELECT
-- "read batch_events (active org)" uses current_org_id() which is more restrictive
-- The ALL policy with org_memberships is the correct pattern
-- ============================================================================
DROP POLICY IF EXISTS "read batch_events (active org)" ON public.batch_events;

-- ============================================================================
-- suppliers - remove redundant SELECT policy (missed earlier)
-- org_rw_suppliers (ALL) covers all operations
-- ============================================================================
DROP POLICY IF EXISTS "read suppliers by org" ON public.suppliers;

-- ============================================================================
-- equipment_types, plant_sizes, plant_varieties
-- These have "Global read" (true) for public read access and
-- "Admin write" (ALL) for authenticated write access
-- The ALL policy includes SELECT which overlaps with "Global read"
-- Solution: Change "Admin write" to separate INSERT, UPDATE, DELETE policies
-- ============================================================================

-- equipment_types
DROP POLICY IF EXISTS "Admin write equipment_types" ON public.equipment_types;
DROP POLICY IF EXISTS "Admin update equipment_types" ON public.equipment_types;
DROP POLICY IF EXISTS "Admin delete equipment_types" ON public.equipment_types;
CREATE POLICY "Admin write equipment_types" ON public.equipment_types
  FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "Admin update equipment_types" ON public.equipment_types
  FOR UPDATE USING ((select auth.role()) = 'authenticated');
CREATE POLICY "Admin delete equipment_types" ON public.equipment_types
  FOR DELETE USING ((select auth.role()) = 'authenticated');

-- plant_sizes
DROP POLICY IF EXISTS "Admin write plant_sizes" ON public.plant_sizes;
DROP POLICY IF EXISTS "Admin update plant_sizes" ON public.plant_sizes;
DROP POLICY IF EXISTS "Admin delete plant_sizes" ON public.plant_sizes;
CREATE POLICY "Admin write plant_sizes" ON public.plant_sizes
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.portal_role = 'internal'));
CREATE POLICY "Admin update plant_sizes" ON public.plant_sizes
  FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.portal_role = 'internal'));
CREATE POLICY "Admin delete plant_sizes" ON public.plant_sizes
  FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.portal_role = 'internal'));

-- plant_varieties
DROP POLICY IF EXISTS "Admin write plant_varieties" ON public.plant_varieties;
DROP POLICY IF EXISTS "Admin update plant_varieties" ON public.plant_varieties;
DROP POLICY IF EXISTS "Admin delete plant_varieties" ON public.plant_varieties;
CREATE POLICY "Admin write plant_varieties" ON public.plant_varieties
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.portal_role = 'internal'));
CREATE POLICY "Admin update plant_varieties" ON public.plant_varieties
  FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.portal_role = 'internal'));
CREATE POLICY "Admin delete plant_varieties" ON public.plant_varieties
  FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.portal_role = 'internal'));
