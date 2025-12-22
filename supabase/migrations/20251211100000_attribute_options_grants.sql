-- Add missing grants for attribute_options table
-- The original migration enabled RLS but forgot to grant table access

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attribute_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attribute_options TO service_role;




