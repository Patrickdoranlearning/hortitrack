-- Fix printers table grants
-- The printers table only had SELECT granted to authenticated users,
-- but INSERT, UPDATE, DELETE were missing, causing "permission denied" errors.

-- Grant full CRUD permissions to authenticated users (RLS still controls access)
GRANT INSERT, UPDATE, DELETE ON public.printers TO authenticated;

-- Also ensure the RLS policy includes WITH CHECK for INSERT operations
-- The current "Admins can manage printers" policy uses the older pattern
-- Let's recreate it to be consistent with the optimized pattern

DROP POLICY IF EXISTS "Admins can manage printers" ON public.printers;
DROP POLICY IF EXISTS "printers_access" ON public.printers;

-- Create optimized policy using user_in_org function
CREATE POLICY "printers_access" ON public.printers
  FOR ALL
  USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));
