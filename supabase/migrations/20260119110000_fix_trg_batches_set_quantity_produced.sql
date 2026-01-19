-- Fix trg_batches_set_quantity_produced to use fully qualified table names
-- The function was broken when search_path was set to '' for security
-- This caused "relation plant_sizes does not exist" errors when creating batches

CREATE OR REPLACE FUNCTION public.trg_batches_set_quantity_produced()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
declare s record;
begin
  select container_type, cell_multiple
    into s
  from public.plant_sizes
  where id = new.size_id;

  new.quantity_produced :=
    public.compute_quantity_produced(new.initial_quantity, s.container_type, s.cell_multiple);

  return new;
end
$$;
