-- Re-create the batches RLS policy that was accidentally dropped
CREATE POLICY tenant_isolation_batches ON public.batches
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));




