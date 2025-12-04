begin;

-- Flatten rich batch events into a legacy-friendly view for UI consumption.
drop view if exists public.batch_logs_view;

create view public.batch_logs_view as
select
  e.id,
  e.org_id,
  e.batch_id,
  e.type,
  coalesce(
    e.payload ->> 'notes',
    e.payload ->> 'reason',
    e.payload ->> 'note'
  ) as note,
  coalesce(
    nullif((e.payload ->> 'qty_change')::integer, 0),
    nullif((e.payload ->> 'units_dumped')::integer, 0),
    nullif((e.payload ->> 'units_moved')::integer, 0),
    nullif((e.payload ->> 'units_reserved')::integer, 0),
    (e.payload ->> 'quantity')::integer,
    0
  ) as qty_change,
  e.by_user_id as actor_id,
  e.at as occurred_at,
  e.created_at
from public.batch_events e;

comment on view public.batch_logs_view is
  'Legacy-compatible view that flattens batch_events JSON payloads for UI history timelines.';


-- Keep batches.reserved_quantity in sync with allocations automatically.
create or replace function public.sync_reserved_quantity()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.batches
      set reserved_quantity = coalesce(reserved_quantity, 0) + coalesce(new.quantity, 0),
          updated_at = greatest(updated_at, now())
      where id = new.batch_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.batches
      set reserved_quantity = coalesce(reserved_quantity, 0) - coalesce(old.quantity, 0),
          updated_at = greatest(updated_at, now())
      where id = old.batch_id;
    return old;
  elsif tg_op = 'UPDATE' then
    if new.batch_id <> old.batch_id then
      update public.batches
        set reserved_quantity = coalesce(reserved_quantity, 0) - coalesce(old.quantity, 0),
            updated_at = greatest(updated_at, now())
        where id = old.batch_id;
      update public.batches
        set reserved_quantity = coalesce(reserved_quantity, 0) + coalesce(new.quantity, 0),
            updated_at = greatest(updated_at, now())
        where id = new.batch_id;
    elsif coalesce(new.quantity, 0) <> coalesce(old.quantity, 0) then
      update public.batches
        set reserved_quantity = coalesce(reserved_quantity, 0) + (coalesce(new.quantity, 0) - coalesce(old.quantity, 0)),
            updated_at = greatest(updated_at, now())
        where id = new.batch_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_reserved_quantity_insert on public.batch_allocations;
drop trigger if exists trg_sync_reserved_quantity_delete on public.batch_allocations;
drop trigger if exists trg_sync_reserved_quantity_update on public.batch_allocations;

create trigger trg_sync_reserved_quantity_insert
after insert on public.batch_allocations
for each row execute function public.sync_reserved_quantity();

create trigger trg_sync_reserved_quantity_delete
after delete on public.batch_allocations
for each row execute function public.sync_reserved_quantity();

create trigger trg_sync_reserved_quantity_update
after update on public.batch_allocations
for each row execute function public.sync_reserved_quantity();

commit;

