-- ================================================
-- FIX DISPATCH MODULE RLS POLICIES
-- ================================================
-- This migration fixes RLS policies for the dispatch module to ensure
-- proper access to pick_lists, pick_items, and qc_feedback tables.
-- The issue was empty error objects `{}` from Supabase due to RLS blocking.
-- ================================================

-- ================================================
-- GRANT VIEW ACCESS
-- ================================================
-- Ensure the picker tasks view is accessible
GRANT SELECT ON v_picker_tasks TO authenticated;
GRANT SELECT ON v_picker_tasks TO service_role;

-- ================================================
-- FIX PICK_LISTS RLS POLICIES
-- ================================================
-- Drop existing policies and create more permissive ones

DROP POLICY IF EXISTS tenant_isolation_pick_lists ON public.pick_lists;
DROP POLICY IF EXISTS "pick_lists_org_access" ON public.pick_lists;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.pick_lists;

-- Create a more robust policy that handles the join with orders
CREATE POLICY tenant_isolation_pick_lists ON public.pick_lists
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- ================================================
-- FIX PICK_ITEMS RLS POLICIES
-- ================================================
-- Ensure pick_items can be accessed when user has access to the pick_list

DROP POLICY IF EXISTS tenant_isolation_pick_items ON public.pick_items;
DROP POLICY IF EXISTS "pick_items_org_access" ON public.pick_items;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.pick_items;

CREATE POLICY tenant_isolation_pick_items ON public.pick_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pick_lists pl
      WHERE pl.id = pick_items.pick_list_id
        AND public.user_in_org(pl.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pick_lists pl
      WHERE pl.id = pick_items.pick_list_id
        AND public.user_in_org(pl.org_id)
    )
  );

-- ================================================
-- FIX QC_FEEDBACK RLS POLICIES
-- ================================================
-- Replace inline subqueries with the optimized user_in_org function

DROP POLICY IF EXISTS "Users can view QC feedback in their org" ON public.qc_feedback;
DROP POLICY IF EXISTS "Users can create QC feedback in their org" ON public.qc_feedback;
DROP POLICY IF EXISTS "Users can update QC feedback in their org" ON public.qc_feedback;

CREATE POLICY tenant_isolation_qc_feedback ON public.qc_feedback
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- ================================================
-- FIX TROLLEY_LABELS RLS POLICIES
-- ================================================
-- Replace inline subqueries with the optimized user_in_org function

DROP POLICY IF EXISTS "Users can view trolley labels in their org" ON public.trolley_labels;
DROP POLICY IF EXISTS "Users can create trolley labels in their org" ON public.trolley_labels;
DROP POLICY IF EXISTS "Users can update trolley labels in their org" ON public.trolley_labels;

CREATE POLICY tenant_isolation_trolley_labels ON public.trolley_labels
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- ================================================
-- FIX PICKING_TEAMS RLS POLICIES
-- ================================================

DROP POLICY IF EXISTS tenant_isolation_picking_teams ON public.picking_teams;
DROP POLICY IF EXISTS "picking_teams_org_access" ON public.picking_teams;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.picking_teams;

CREATE POLICY tenant_isolation_picking_teams ON public.picking_teams
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-- ================================================
-- FIX PICKING_TEAM_MEMBERS RLS POLICIES
-- ================================================

DROP POLICY IF EXISTS tenant_isolation_picking_team_members ON public.picking_team_members;
DROP POLICY IF EXISTS "picking_team_members_org_access" ON public.picking_team_members;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.picking_team_members;

CREATE POLICY tenant_isolation_picking_team_members ON public.picking_team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.picking_teams pt
      WHERE pt.id = picking_team_members.team_id
        AND public.user_in_org(pt.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.picking_teams pt
      WHERE pt.id = picking_team_members.team_id
        AND public.user_in_org(pt.org_id)
    )
  );

-- ================================================
-- ENSURE GRANTS
-- ================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pick_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pick_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trolley_labels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.picking_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.picking_team_members TO authenticated;

-- Service role full access
GRANT ALL ON public.pick_lists TO service_role;
GRANT ALL ON public.pick_items TO service_role;
GRANT ALL ON public.qc_feedback TO service_role;
GRANT ALL ON public.trolley_labels TO service_role;
GRANT ALL ON public.picking_teams TO service_role;
GRANT ALL ON public.picking_team_members TO service_role;

-- ================================================
-- ADD INDEX TO SPEED UP RLS CHECKS
-- ================================================

CREATE INDEX IF NOT EXISTS idx_pick_lists_org_assigned_status
  ON public.pick_lists(org_id, assigned_user_id, status);

CREATE INDEX IF NOT EXISTS idx_pick_items_pick_list_id
  ON public.pick_items(pick_list_id);

CREATE INDEX IF NOT EXISTS idx_qc_feedback_org_id
  ON public.qc_feedback(org_id);

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON POLICY tenant_isolation_pick_lists ON public.pick_lists IS
  'Users can access pick lists in organizations they belong to';

COMMENT ON POLICY tenant_isolation_pick_items ON public.pick_items IS
  'Users can access pick items for pick lists in their organization';

COMMENT ON POLICY tenant_isolation_qc_feedback ON public.qc_feedback IS
  'Users can access QC feedback in organizations they belong to';
