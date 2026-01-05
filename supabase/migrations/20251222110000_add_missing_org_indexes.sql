-- Improve org_id filtering performance across sales/product tables
create index if not exists idx_price_lists_org_id on public.price_lists(org_id);
create index if not exists idx_products_org_id on public.products(org_id);
create index if not exists idx_product_batches_org_id on public.product_batches(org_id);
create index if not exists idx_product_prices_org_id on public.product_prices(org_id);
create index if not exists idx_price_list_customers_org_id on public.price_list_customers(org_id);
create index if not exists idx_product_aliases_org_id on public.product_aliases(org_id);
create index if not exists idx_order_events_org_id on public.order_events(org_id);
create index if not exists idx_order_exceptions_org_id on public.order_exceptions(org_id);





