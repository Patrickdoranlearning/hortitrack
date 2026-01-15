-- Fix multiple_permissive_policies warnings
-- Remove redundant SELECT policies when an ALL policy with the same condition already exists
-- The ALL policy covers SELECT, INSERT, UPDATE, DELETE - so a separate SELECT policy is redundant

-- ============================================================================
-- Tables with redundant "view" policies when "manage" (ALL) policy exists
-- These all have identical conditions, so we can safely remove the SELECT-only policies
-- ============================================================================

-- batch_plans
DROP POLICY IF EXISTS "Users can view org batch_plans" ON public.batch_plans;

-- checklist_templates
DROP POLICY IF EXISTS "Users can view org checklist templates" ON public.checklist_templates;

-- guide_plans
DROP POLICY IF EXISTS "Users can view org guide_plans" ON public.guide_plans;

-- ipm_assignments
DROP POLICY IF EXISTS "Users can view org ipm_assignments" ON public.ipm_assignments;

-- ipm_product_bottles
DROP POLICY IF EXISTS "Users can view org bottles" ON public.ipm_product_bottles;

-- ipm_products
DROP POLICY IF EXISTS "Users can view org ipm_products" ON public.ipm_products;

-- ipm_program_steps
DROP POLICY IF EXISTS "Users can view program steps" ON public.ipm_program_steps;

-- ipm_programs
DROP POLICY IF EXISTS "Users can view org ipm_programs" ON public.ipm_programs;

-- ipm_spot_treatments
DROP POLICY IF EXISTS "Users can view org ipm_spot_treatments" ON public.ipm_spot_treatments;

-- ipm_stock_movements
DROP POLICY IF EXISTS "Users can view org movements" ON public.ipm_stock_movements;

-- order_fees
DROP POLICY IF EXISTS "Users can view order fees for their org orders" ON public.order_fees;

-- order_item_preferences
DROP POLICY IF EXISTS "Users can view order_item_preferences in their org" ON public.order_item_preferences;

-- org_fees
DROP POLICY IF EXISTS "Users can view org fees for their org" ON public.org_fees;

-- planned_batch_materials
DROP POLICY IF EXISTS "Users can view org planned batch materials" ON public.planned_batch_materials;

-- product_group_aliases
DROP POLICY IF EXISTS "Users can view product_group_aliases in their org" ON public.product_group_aliases;

-- product_group_members
DROP POLICY IF EXISTS "Users can view product_group_members in their org" ON public.product_group_members;

-- product_groups
DROP POLICY IF EXISTS "Users can view product_groups in their org" ON public.product_groups;

-- product_varieties
DROP POLICY IF EXISTS "Users can view product_varieties in their org" ON public.product_varieties;

-- production_job_batches
DROP POLICY IF EXISTS "Users can view org job batches" ON public.production_job_batches;

-- production_jobs
DROP POLICY IF EXISTS "Users can view org production jobs" ON public.production_jobs;

-- protocol_performance
DROP POLICY IF EXISTS "Users can view org protocol performance" ON public.protocol_performance;

-- protocols
DROP POLICY IF EXISTS "Users can view org protocols" ON public.protocols;

-- tasks
DROP POLICY IF EXISTS "Users can view org tasks" ON public.tasks;

-- trial_findings
DROP POLICY IF EXISTS "Users can view trial findings" ON public.trial_findings;

-- trial_groups
DROP POLICY IF EXISTS "Users can view trial groups" ON public.trial_groups;

-- trial_measurements
DROP POLICY IF EXISTS "Users can view trial measurements" ON public.trial_measurements;

-- trial_subjects
DROP POLICY IF EXISTS "Users can view trial subjects" ON public.trial_subjects;

-- trial_treatments
DROP POLICY IF EXISTS "Users can view trial treatments" ON public.trial_treatments;

-- trials
DROP POLICY IF EXISTS "Users can view org trials" ON public.trials;

-- ============================================================================
-- profiles table - consolidate 3 SELECT policies into one
-- Current: profiles_self_read, profiles_admin_view_org_members, Customer portal users can view own profile
-- All of these overlap on the user viewing their own profile
-- ============================================================================

-- Drop all SELECT policies
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
DROP POLICY IF EXISTS "Customer portal users can view own profile" ON public.profiles;
-- Keep profiles_admin_view_org_members as it already includes self-read condition

-- ============================================================================
-- invoice_items - has duplicate ALL policies (ii_rw and tenant_isolation_invoice_items)
-- Need to check which one to keep
-- ============================================================================
-- Note: These may have different conditions - leaving for manual review
-- DROP POLICY IF EXISTS "ii_rw" ON public.invoice_items;
