-- Fix RLS initplan performance warnings
-- Wrap auth.uid() and auth.role() calls in (select ...) to prevent per-row evaluation

-- ============================================================================
-- material_categories
-- ============================================================================
DROP POLICY IF EXISTS "authenticated_read_material_categories" ON public.material_categories;
CREATE POLICY "authenticated_read_material_categories" ON public.material_categories
  FOR SELECT USING ((select auth.role()) = 'authenticated');

-- ============================================================================
-- eircode_zones
-- ============================================================================
DROP POLICY IF EXISTS "authenticated_read_eircode_zones" ON public.eircode_zones;
CREATE POLICY "authenticated_read_eircode_zones" ON public.eircode_zones
  FOR SELECT USING ((select auth.role()) = 'authenticated');

-- ============================================================================
-- checklist_templates
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org checklist templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Org members can manage checklist templates" ON public.checklist_templates;

CREATE POLICY "Users can view org checklist templates" ON public.checklist_templates
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Org members can manage checklist templates" ON public.checklist_templates
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  ) WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- delivery_items
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own org delivery items" ON public.delivery_items;
DROP POLICY IF EXISTS "Users can create delivery items in own org" ON public.delivery_items;
DROP POLICY IF EXISTS "Users can update own org delivery items" ON public.delivery_items;
DROP POLICY IF EXISTS "Users can delete own org delivery items" ON public.delivery_items;

CREATE POLICY "Users can view own org delivery items" ON public.delivery_items
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can create delivery items in own org" ON public.delivery_items
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can update own org delivery items" ON public.delivery_items
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can delete own org delivery items" ON public.delivery_items
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- delivery_runs
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own org delivery runs" ON public.delivery_runs;
DROP POLICY IF EXISTS "Users can create delivery runs in own org" ON public.delivery_runs;
DROP POLICY IF EXISTS "Users can update own org delivery runs" ON public.delivery_runs;
DROP POLICY IF EXISTS "Users can delete own org delivery runs" ON public.delivery_runs;

CREATE POLICY "Users can view own org delivery runs" ON public.delivery_runs
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can create delivery runs in own org" ON public.delivery_runs
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can update own org delivery runs" ON public.delivery_runs
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can delete own org delivery runs" ON public.delivery_runs
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- document_templates
-- ============================================================================
DROP POLICY IF EXISTS "document_templates_select" ON public.document_templates;
DROP POLICY IF EXISTS "document_templates_insert" ON public.document_templates;
DROP POLICY IF EXISTS "document_templates_update" ON public.document_templates;
DROP POLICY IF EXISTS "document_templates_delete" ON public.document_templates;

CREATE POLICY "document_templates_select" ON public.document_templates
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "document_templates_insert" ON public.document_templates
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "document_templates_update" ON public.document_templates
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "document_templates_delete" ON public.document_templates
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- document_template_versions
-- ============================================================================
DROP POLICY IF EXISTS "document_template_versions_select" ON public.document_template_versions;
DROP POLICY IF EXISTS "document_template_versions_insert" ON public.document_template_versions;
DROP POLICY IF EXISTS "document_template_versions_update" ON public.document_template_versions;
DROP POLICY IF EXISTS "document_template_versions_delete" ON public.document_template_versions;

CREATE POLICY "document_template_versions_select" ON public.document_template_versions
  FOR SELECT USING (
    template_id IN (SELECT id FROM public.document_templates WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  );

CREATE POLICY "document_template_versions_insert" ON public.document_template_versions
  FOR INSERT WITH CHECK (
    template_id IN (SELECT id FROM public.document_templates WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  );

CREATE POLICY "document_template_versions_update" ON public.document_template_versions
  FOR UPDATE USING (
    template_id IN (SELECT id FROM public.document_templates WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  );

CREATE POLICY "document_template_versions_delete" ON public.document_template_versions
  FOR DELETE USING (
    template_id IN (SELECT id FROM public.document_templates WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  );

-- ============================================================================
-- equipment_movement_log
-- ============================================================================
DROP POLICY IF EXISTS "Users can view equipment movements in their org" ON public.equipment_movement_log;
DROP POLICY IF EXISTS "Users can insert equipment movements in their org" ON public.equipment_movement_log;
DROP POLICY IF EXISTS "Users can update equipment movements in their org" ON public.equipment_movement_log;
DROP POLICY IF EXISTS "Users can delete equipment movements in their org" ON public.equipment_movement_log;

CREATE POLICY "Users can view equipment movements in their org" ON public.equipment_movement_log
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can insert equipment movements in their org" ON public.equipment_movement_log
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can update equipment movements in their org" ON public.equipment_movement_log
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can delete equipment movements in their org" ON public.equipment_movement_log
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- haulier_vehicles (has duplicate policies - cleaning up)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view vehicles in their org" ON public.haulier_vehicles;
DROP POLICY IF EXISTS "Users can insert vehicles in their org" ON public.haulier_vehicles;
DROP POLICY IF EXISTS "Users can update vehicles in their org" ON public.haulier_vehicles;
DROP POLICY IF EXISTS "Users can delete vehicles in their org" ON public.haulier_vehicles;
DROP POLICY IF EXISTS "Users can view haulier vehicles in their org" ON public.haulier_vehicles;
DROP POLICY IF EXISTS "Users can insert haulier vehicles in their org" ON public.haulier_vehicles;
DROP POLICY IF EXISTS "Users can update haulier vehicles in their org" ON public.haulier_vehicles;
DROP POLICY IF EXISTS "Users can delete haulier vehicles in their org" ON public.haulier_vehicles;

CREATE POLICY "Users can view vehicles in their org" ON public.haulier_vehicles
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can insert vehicles in their org" ON public.haulier_vehicles
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can update vehicles in their org" ON public.haulier_vehicles
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can delete vehicles in their org" ON public.haulier_vehicles
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- ipm_product_bottles
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org bottles" ON public.ipm_product_bottles;
DROP POLICY IF EXISTS "Users can manage org bottles" ON public.ipm_product_bottles;

CREATE POLICY "Users can view org bottles" ON public.ipm_product_bottles
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can manage org bottles" ON public.ipm_product_bottles
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  ) WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- ipm_program_steps
-- ============================================================================
DROP POLICY IF EXISTS "Users can view program steps" ON public.ipm_program_steps;
DROP POLICY IF EXISTS "Users can manage program steps" ON public.ipm_program_steps;

CREATE POLICY "Users can view program steps" ON public.ipm_program_steps
  FOR SELECT USING (
    program_id IN (SELECT id FROM public.ipm_programs WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  );

CREATE POLICY "Users can manage program steps" ON public.ipm_program_steps
  FOR ALL USING (
    program_id IN (SELECT id FROM public.ipm_programs WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  ) WITH CHECK (
    program_id IN (SELECT id FROM public.ipm_programs WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  );

-- ============================================================================
-- ipm_stock_movements
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org movements" ON public.ipm_stock_movements;
DROP POLICY IF EXISTS "Users can manage org movements" ON public.ipm_stock_movements;

CREATE POLICY "Users can view org movements" ON public.ipm_stock_movements
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can manage org movements" ON public.ipm_stock_movements
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  ) WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- org_memberships
-- ============================================================================
DROP POLICY IF EXISTS "org_memberships_admin_select" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_admin_insert" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_admin_update" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_admin_delete" ON public.org_memberships;

CREATE POLICY "org_memberships_admin_select" ON public.org_memberships
  FOR SELECT USING (
    ((select auth.uid()) = user_id) OR
    (EXISTS (SELECT 1 FROM public.org_admin_check ac WHERE ac.org_id = org_memberships.org_id AND ac.user_id = (select auth.uid())))
  );

CREATE POLICY "org_memberships_admin_insert" ON public.org_memberships
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.org_admin_check ac WHERE ac.org_id = org_memberships.org_id AND ac.user_id = (select auth.uid()))
  );

CREATE POLICY "org_memberships_admin_update" ON public.org_memberships
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.org_admin_check ac WHERE ac.org_id = org_memberships.org_id AND ac.user_id = (select auth.uid()))
  );

CREATE POLICY "org_memberships_admin_delete" ON public.org_memberships
  FOR DELETE USING (
    (EXISTS (SELECT 1 FROM public.org_admin_check ac WHERE ac.org_id = org_memberships.org_id AND ac.user_id = (select auth.uid())))
    AND NOT (user_id = (select auth.uid()) AND role = 'owner')
  );

-- ============================================================================
-- profiles
-- ============================================================================
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_view_org_members" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update_org_members" ON public.profiles;

CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT USING (id = (select auth.uid()));

CREATE POLICY "profiles_admin_view_org_members" ON public.profiles
  FOR SELECT USING (
    (id = (select auth.uid())) OR
    (EXISTS (
      SELECT 1 FROM public.org_memberships my_membership
      JOIN public.org_memberships their_membership ON my_membership.org_id = their_membership.org_id
      WHERE my_membership.user_id = (select auth.uid())
        AND my_membership.role = ANY (ARRAY['owner'::org_role, 'admin'::org_role])
        AND their_membership.user_id = profiles.id
    ))
  );

CREATE POLICY "profiles_admin_update_org_members" ON public.profiles
  FOR UPDATE USING (
    (id = (select auth.uid())) OR
    (EXISTS (
      SELECT 1 FROM public.org_memberships my_membership
      JOIN public.org_memberships their_membership ON my_membership.org_id = their_membership.org_id
      WHERE my_membership.user_id = (select auth.uid())
        AND my_membership.role = ANY (ARRAY['owner'::org_role, 'admin'::org_role])
        AND their_membership.user_id = profiles.id
    ))
  );

-- ============================================================================
-- protocol_performance
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org protocol performance" ON public.protocol_performance;
DROP POLICY IF EXISTS "Users can manage org protocol performance" ON public.protocol_performance;

CREATE POLICY "Users can view org protocol performance" ON public.protocol_performance
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can manage org protocol performance" ON public.protocol_performance
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  ) WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );
