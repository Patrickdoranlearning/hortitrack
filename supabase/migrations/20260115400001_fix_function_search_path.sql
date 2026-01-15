-- Fix function_search_path_mutable warnings
-- Set search_path to empty string for all functions to prevent search path injection attacks
-- Uses dynamic SQL to safely handle functions that may or may not exist

-- Create a helper function to safely alter function search_path
CREATE OR REPLACE FUNCTION pg_temp.safe_set_search_path(func_signature text)
RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', func_signature);
EXCEPTION WHEN undefined_function THEN
  -- Function doesn't exist with this signature, skip silently
  NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply search_path fix to all reported functions
SELECT pg_temp.safe_set_search_path('public.set_delivery_run_week_number()');
SELECT pg_temp.safe_set_search_path('public.update_supplier_addresses_updated_at()');
SELECT pg_temp.safe_set_search_path('public.ensure_single_default_printer()');
SELECT pg_temp.safe_set_search_path('public.ensure_single_default_template()');
SELECT pg_temp.safe_set_search_path('public.recalculate_customer_trolley_balance(uuid)');
SELECT pg_temp.safe_set_search_path('public.sync_trolley_balance_from_movement()');
SELECT pg_temp.safe_set_search_path('public.sync_trolley_balance_from_movement_delete()');
SELECT pg_temp.safe_set_search_path('public.update_material_stock_on_transaction()');
SELECT pg_temp.safe_set_search_path('public.update_materials_updated_at()');
SELECT pg_temp.safe_set_search_path('public.touch_document_templates()');
SELECT pg_temp.safe_set_search_path('public.update_spot_treatment_next_date()');
SELECT pg_temp.safe_set_search_path('public.create_order_with_allocations(jsonb)');
SELECT pg_temp.safe_set_search_path('public.sync_reserved_quantity()');
SELECT pg_temp.safe_set_search_path('public.fn_format_batch_number(bigint)');
SELECT pg_temp.safe_set_search_path('public.increment_counter(text)');
SELECT pg_temp.safe_set_search_path('public.update_updated_at_column()');
SELECT pg_temp.safe_set_search_path('public.increment_org_counter(uuid, text)');
SELECT pg_temp.safe_set_search_path('public.fn_next_org_counter(uuid, text)');
SELECT pg_temp.safe_set_search_path('public.compute_quantity_produced(text)');
SELECT pg_temp.safe_set_search_path('public.update_customer_trolley_balance()');
SELECT pg_temp.safe_set_search_path('public.update_bottle_on_movement()');
SELECT pg_temp.safe_set_search_path('public.generate_bottle_code()');
SELECT pg_temp.safe_set_search_path('public.generate_trial_number(uuid)');
SELECT pg_temp.safe_set_search_path('public.update_planned_batch_materials_updated_at()');
SELECT pg_temp.safe_set_search_path('public.get_guide_plan_progress(uuid)');
SELECT pg_temp.safe_set_search_path('public.get_product_group_members(uuid)');
SELECT pg_temp.safe_set_search_path('public.get_batch_plan_progress(uuid)');
SELECT pg_temp.safe_set_search_path('public.search_batches_for_scout(text, uuid, integer)');
SELECT pg_temp.safe_set_search_path('public.refresh_customer_order_patterns()');
SELECT pg_temp.safe_set_search_path('public.set_updated_at()');
SELECT pg_temp.safe_set_search_path('public.decrement_batch_quantity(uuid, integer, text)');
SELECT pg_temp.safe_set_search_path('public.trg_touch_invoice()');
SELECT pg_temp.safe_set_search_path('public.apply_order_item_substitution(uuid, uuid, uuid)');
SELECT pg_temp.safe_set_search_path('public.refresh_log_history_for_batch(uuid)');
SELECT pg_temp.safe_set_search_path('public.trg_batch_logs_sync()');
SELECT pg_temp.safe_set_search_path('public.trg_batches_set_quantity_produced()');
SELECT pg_temp.safe_set_search_path('public.trg_sizes_touch_batch_produced()');
SELECT pg_temp.safe_set_search_path('public.calc_order_item_totals()');
SELECT pg_temp.safe_set_search_path('public.recalc_order_totals(uuid)');
SELECT pg_temp.safe_set_search_path('public.trg_recalc_order_totals()');
SELECT pg_temp.safe_set_search_path('public.trg_recalc_order_totals_from_allocation()');
SELECT pg_temp.safe_set_search_path('public.next_counter(text)');
SELECT pg_temp.safe_set_search_path('public.generate_invoice_number(uuid)');
SELECT pg_temp.safe_set_search_path('public.calc_invoice_item_totals()');
SELECT pg_temp.safe_set_search_path('public.calc_credit_item_totals()');
SELECT pg_temp.safe_set_search_path('public.get_batch_distribution(uuid)');
SELECT pg_temp.safe_set_search_path('public.generate_credit_number(uuid)');
SELECT pg_temp.safe_set_search_path('public.trg_invoices_assign_number()');
SELECT pg_temp.safe_set_search_path('public.cleanup_stale_print_queue()');
SELECT pg_temp.safe_set_search_path('public.trg_credits_assign_number()');
SELECT pg_temp.safe_set_search_path('public.recalc_invoice_totals(uuid)');
SELECT pg_temp.safe_set_search_path('public.mark_stale_agents_offline()');
SELECT pg_temp.safe_set_search_path('public.auto_link_batch_to_products()');
SELECT pg_temp.safe_set_search_path('public.increment_batch_quantity(uuid, integer, text)');
SELECT pg_temp.safe_set_search_path('public.next_sku_code(uuid)');
