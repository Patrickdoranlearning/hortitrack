-- Add reserved_quantity column to track planned allocations
-- This represents quantity that is committed to planned batches but not yet transferred

alter table public.batches
  add column if not exists reserved_quantity integer not null default 0;

-- Add a check constraint to ensure reserved doesn't exceed quantity
alter table public.batches
  add constraint batches_reserved_not_exceeding_quantity
  check (reserved_quantity >= 0 and reserved_quantity <= quantity);

-- Add index for queries filtering by reserved quantity
create index if not exists batches_reserved_quantity_idx 
  on public.batches(reserved_quantity) 
  where reserved_quantity > 0;

comment on column public.batches.reserved_quantity is 'Quantity reserved for planned batches (not yet transferred)';







