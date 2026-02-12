-- Fix: hauliers table only had SELECT for authenticated role
-- This caused "permission denied for table hauliers" on INSERT/UPDATE/DELETE
GRANT INSERT, UPDATE, DELETE ON public.hauliers TO authenticated;
