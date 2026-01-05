-- Performance improvements: add critical indexes and mark helper STABLE

-- 1) Indexes on high-traffic FK columns (org_id + join keys)
CREATE INDEX IF NOT EXISTS idx_batches_org_id ON public.batches(org_id);
CREATE INDEX IF NOT EXISTS idx_batches_plant_variety_id ON public.batches(plant_variety_id);
CREATE INDEX IF NOT EXISTS idx_batches_location_id ON public.batches(location_id);
CREATE INDEX IF NOT EXISTS idx_batches_size_id ON public.batches(size_id);

CREATE INDEX IF NOT EXISTS idx_orders_org_id ON public.orders(org_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku_id ON public.order_items(sku_id);

CREATE INDEX IF NOT EXISTS idx_pick_lists_order_id ON public.pick_lists(order_id);
CREATE INDEX IF NOT EXISTS idx_pick_items_pick_list_id ON public.pick_items(pick_list_id);

-- 2) Mark user_in_org STABLE so Postgres can cache within a statement
CREATE OR REPLACE FUNCTION public.user_in_org(target_org_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
STABLE
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships m
    WHERE m.org_id = target_org_id
      AND m.user_id = (select auth.uid())
  );
$$;


