-- ================================================
-- FIX HAULIERS RLS POLICY - ADD ORG ISOLATION
-- ================================================
-- Previous policy allowed ANY authenticated user to access ALL hauliers
-- This fix adds proper org-based tenant isolation
-- ================================================

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage hauliers" ON public.hauliers;

-- Create new policy with proper org isolation
CREATE POLICY "Org members can manage hauliers" ON public.hauliers
  FOR ALL
  USING (
    org_id IN (
      SELECT om.org_id
      FROM public.org_memberships om
      WHERE om.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT om.org_id
      FROM public.org_memberships om
      WHERE om.user_id = (SELECT auth.uid())
    )
  );

-- Add comment explaining the policy
COMMENT ON POLICY "Org members can manage hauliers" ON public.hauliers IS
  'Users can only access hauliers belonging to organizations they are members of. '
  'Fixed in 20260120230000 to add org-level tenant isolation.';
