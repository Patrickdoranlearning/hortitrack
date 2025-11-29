-- Align plant_sizes schema with UI fields
alter table public.plant_sizes
  add column if not exists shelf_quantity integer,
  add column if not exists area numeric;

