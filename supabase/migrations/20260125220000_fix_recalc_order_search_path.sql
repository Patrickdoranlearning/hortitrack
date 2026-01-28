-- Fix search_path for order recalculation functions
-- The functions have empty search_path which prevents them from finding each other

-- Fix recalc_order_totals
ALTER FUNCTION public.recalc_order_totals(_order_id uuid)
SET search_path = public;

-- Fix trg_recalc_order_totals (trigger function)
ALTER FUNCTION public.trg_recalc_order_totals()
SET search_path = public;

-- Fix trg_recalc_order_totals_from_allocation (trigger function for allocations)
ALTER FUNCTION public.trg_recalc_order_totals_from_allocation()
SET search_path = public;

-- Also fix create_order_with_allocations to use public schema
ALTER FUNCTION public.create_order_with_allocations(
  p_org_id uuid,
  p_customer_id uuid,
  p_order_number text,
  p_lines jsonb,
  p_requested_delivery_date date,
  p_notes text
)
SET search_path = public;
