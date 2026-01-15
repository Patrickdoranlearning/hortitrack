-- Fix checklist templates RLS to allow all org members to manage templates
-- Previously required admin/owner role, but templates are organizational config
-- that should be editable by editors and managers

-- Drop the restrictive admin-only policy
DROP POLICY IF EXISTS "Admins can manage org checklist templates" ON public.checklist_templates;

-- Create new policy allowing all org members to manage templates
DROP POLICY IF EXISTS "Org members can manage checklist templates" ON public.checklist_templates;
CREATE POLICY "Org members can manage checklist templates" ON public.checklist_templates
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_memberships
      WHERE user_id = auth.uid()
    )
  );
