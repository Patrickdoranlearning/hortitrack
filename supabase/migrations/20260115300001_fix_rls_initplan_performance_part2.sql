-- Fix RLS initplan performance warnings - Part 2
-- Additional tables not in initial list

-- ============================================================================
-- batch_images
-- ============================================================================
DROP POLICY IF EXISTS "batch_images_select_org" ON public.batch_images;
DROP POLICY IF EXISTS "batch_images_insert_org" ON public.batch_images;
DROP POLICY IF EXISTS "batch_images_update_org" ON public.batch_images;
DROP POLICY IF EXISTS "batch_images_delete_org" ON public.batch_images;

CREATE POLICY "batch_images_select_org" ON public.batch_images
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "batch_images_insert_org" ON public.batch_images
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "batch_images_update_org" ON public.batch_images
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "batch_images_delete_org" ON public.batch_images
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- order_item_preferences
-- ============================================================================
DROP POLICY IF EXISTS "Users can view order_item_preferences in their org" ON public.order_item_preferences;
DROP POLICY IF EXISTS "Users can manage order_item_preferences in their org" ON public.order_item_preferences;

CREATE POLICY "Users can view order_item_preferences in their org" ON public.order_item_preferences
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can manage order_item_preferences in their org" ON public.order_item_preferences
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- planned_batch_materials
-- ============================================================================
DROP POLICY IF EXISTS "Users can view org planned batch materials" ON public.planned_batch_materials;
DROP POLICY IF EXISTS "Users can manage org planned batch materials" ON public.planned_batch_materials;

CREATE POLICY "Users can view org planned batch materials" ON public.planned_batch_materials
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can manage org planned batch materials" ON public.planned_batch_materials
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  ) WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- product_groups
-- ============================================================================
DROP POLICY IF EXISTS "Users can view product_groups in their org" ON public.product_groups;
DROP POLICY IF EXISTS "Users can manage product_groups in their org" ON public.product_groups;

CREATE POLICY "Users can view product_groups in their org" ON public.product_groups
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can manage product_groups in their org" ON public.product_groups
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- product_group_aliases
-- ============================================================================
DROP POLICY IF EXISTS "Users can view product_group_aliases in their org" ON public.product_group_aliases;
DROP POLICY IF EXISTS "Users can manage product_group_aliases in their org" ON public.product_group_aliases;

CREATE POLICY "Users can view product_group_aliases in their org" ON public.product_group_aliases
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can manage product_group_aliases in their org" ON public.product_group_aliases
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- product_group_members
-- ============================================================================
DROP POLICY IF EXISTS "Users can view product_group_members in their org" ON public.product_group_members;
DROP POLICY IF EXISTS "Users can manage product_group_members in their org" ON public.product_group_members;

CREATE POLICY "Users can view product_group_members in their org" ON public.product_group_members
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can manage product_group_members in their org" ON public.product_group_members
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- product_varieties
-- ============================================================================
DROP POLICY IF EXISTS "Users can view product_varieties in their org" ON public.product_varieties;
DROP POLICY IF EXISTS "Users can manage product_varieties in their org" ON public.product_varieties;

CREATE POLICY "Users can view product_varieties in their org" ON public.product_varieties
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can manage product_varieties in their org" ON public.product_varieties
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- supplier_addresses
-- ============================================================================
DROP POLICY IF EXISTS "Users can view supplier addresses in their org" ON public.supplier_addresses;
DROP POLICY IF EXISTS "Users can insert supplier addresses in their org" ON public.supplier_addresses;
DROP POLICY IF EXISTS "Users can update supplier addresses in their org" ON public.supplier_addresses;
DROP POLICY IF EXISTS "Users can delete supplier addresses in their org" ON public.supplier_addresses;

CREATE POLICY "Users can view supplier addresses in their org" ON public.supplier_addresses
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can insert supplier addresses in their org" ON public.supplier_addresses
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can update supplier addresses in their org" ON public.supplier_addresses
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can delete supplier addresses in their org" ON public.supplier_addresses
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- trial_findings
-- ============================================================================
DROP POLICY IF EXISTS "Users can view trial findings" ON public.trial_findings;
DROP POLICY IF EXISTS "Users can manage trial findings" ON public.trial_findings;

CREATE POLICY "Users can view trial findings" ON public.trial_findings
  FOR SELECT USING (
    trial_id IN (SELECT id FROM public.trials WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  );

CREATE POLICY "Users can manage trial findings" ON public.trial_findings
  FOR ALL USING (
    trial_id IN (SELECT id FROM public.trials WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  ) WITH CHECK (
    trial_id IN (SELECT id FROM public.trials WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  );

-- ============================================================================
-- trial_groups
-- ============================================================================
DROP POLICY IF EXISTS "Users can view trial groups" ON public.trial_groups;
DROP POLICY IF EXISTS "Users can manage trial groups" ON public.trial_groups;

CREATE POLICY "Users can view trial groups" ON public.trial_groups
  FOR SELECT USING (
    trial_id IN (SELECT id FROM public.trials WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  );

CREATE POLICY "Users can manage trial groups" ON public.trial_groups
  FOR ALL USING (
    trial_id IN (SELECT id FROM public.trials WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  ) WITH CHECK (
    trial_id IN (SELECT id FROM public.trials WHERE org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
    ))
  );

-- ============================================================================
-- trial_subjects
-- ============================================================================
DROP POLICY IF EXISTS "Users can view trial subjects" ON public.trial_subjects;
DROP POLICY IF EXISTS "Users can manage trial subjects" ON public.trial_subjects;

CREATE POLICY "Users can view trial subjects" ON public.trial_subjects
  FOR SELECT USING (
    group_id IN (SELECT id FROM public.trial_groups WHERE trial_id IN (
      SELECT id FROM public.trials WHERE org_id IN (
        SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
      )
    ))
  );

CREATE POLICY "Users can manage trial subjects" ON public.trial_subjects
  FOR ALL USING (
    group_id IN (SELECT id FROM public.trial_groups WHERE trial_id IN (
      SELECT id FROM public.trials WHERE org_id IN (
        SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
      )
    ))
  ) WITH CHECK (
    group_id IN (SELECT id FROM public.trial_groups WHERE trial_id IN (
      SELECT id FROM public.trials WHERE org_id IN (
        SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
      )
    ))
  );

-- ============================================================================
-- trial_treatments
-- ============================================================================
DROP POLICY IF EXISTS "Users can view trial treatments" ON public.trial_treatments;
DROP POLICY IF EXISTS "Users can manage trial treatments" ON public.trial_treatments;

CREATE POLICY "Users can view trial treatments" ON public.trial_treatments
  FOR SELECT USING (
    group_id IN (SELECT id FROM public.trial_groups WHERE trial_id IN (
      SELECT id FROM public.trials WHERE org_id IN (
        SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
      )
    ))
  );

CREATE POLICY "Users can manage trial treatments" ON public.trial_treatments
  FOR ALL USING (
    group_id IN (SELECT id FROM public.trial_groups WHERE trial_id IN (
      SELECT id FROM public.trials WHERE org_id IN (
        SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
      )
    ))
  ) WITH CHECK (
    group_id IN (SELECT id FROM public.trial_groups WHERE trial_id IN (
      SELECT id FROM public.trials WHERE org_id IN (
        SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
      )
    ))
  );

-- ============================================================================
-- trial_measurements
-- ============================================================================
DROP POLICY IF EXISTS "Users can view trial measurements" ON public.trial_measurements;
DROP POLICY IF EXISTS "Users can manage trial measurements" ON public.trial_measurements;

CREATE POLICY "Users can view trial measurements" ON public.trial_measurements
  FOR SELECT USING (
    subject_id IN (SELECT id FROM public.trial_subjects WHERE group_id IN (
      SELECT id FROM public.trial_groups WHERE trial_id IN (
        SELECT id FROM public.trials WHERE org_id IN (
          SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
        )
      )
    ))
  );

CREATE POLICY "Users can manage trial measurements" ON public.trial_measurements
  FOR ALL USING (
    subject_id IN (SELECT id FROM public.trial_subjects WHERE group_id IN (
      SELECT id FROM public.trial_groups WHERE trial_id IN (
        SELECT id FROM public.trials WHERE org_id IN (
          SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
        )
      )
    ))
  ) WITH CHECK (
    subject_id IN (SELECT id FROM public.trial_subjects WHERE group_id IN (
      SELECT id FROM public.trial_groups WHERE trial_id IN (
        SELECT id FROM public.trials WHERE org_id IN (
          SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid())
        )
      )
    ))
  );

-- ============================================================================
-- trolley_capacity
-- ============================================================================
DROP POLICY IF EXISTS "trolley_capacity_org_read" ON public.trolley_capacity;
DROP POLICY IF EXISTS "trolley_capacity_org_insert" ON public.trolley_capacity;
DROP POLICY IF EXISTS "trolley_capacity_org_update" ON public.trolley_capacity;
DROP POLICY IF EXISTS "trolley_capacity_org_delete" ON public.trolley_capacity;

CREATE POLICY "trolley_capacity_org_read" ON public.trolley_capacity
  FOR SELECT TO authenticated USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "trolley_capacity_org_insert" ON public.trolley_capacity
  FOR INSERT TO authenticated WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "trolley_capacity_org_update" ON public.trolley_capacity
  FOR UPDATE TO authenticated USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "trolley_capacity_org_delete" ON public.trolley_capacity
  FOR DELETE TO authenticated USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = (select auth.uid()))
  );
