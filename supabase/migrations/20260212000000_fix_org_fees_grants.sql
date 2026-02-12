-- Fix: Grant INSERT, UPDATE, DELETE on org_fees and order_fees to authenticated role
-- The original migration only created RLS policies but never granted write permissions
-- to the authenticated role, causing "permission denied for table org_fees" errors
GRANT INSERT, UPDATE, DELETE ON org_fees TO authenticated;
GRANT INSERT, UPDATE, DELETE ON order_fees TO authenticated;
