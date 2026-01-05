-- Add production status_id (FK to attribute_options) and plant health logs

-- 1) Plant health event enum + table
create type if not exists public.health_event_type as enum ('scout_flag', 'treatment', 'measurement', 'clearance');

create table if not exists public.plant_health_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  batch_id uuid references public.batches(id),
  location_id uuid references public.nursery_locations(id),
  event_type public.health_event_type not null,
  event_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id),
  title text,
  notes text,
  measurements jsonb, -- structured data for EC/pH/etc.
  photos text[], -- storage paths or URLs
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plant_health_logs is 'Logs for plant health scouting, treatments, measurements, and clearances.';

create index if not exists plant_health_logs_org_id_idx on public.plant_health_logs(org_id);
create index if not exists plant_health_logs_batch_id_idx on public.plant_health_logs(batch_id);
create index if not exists plant_health_logs_location_id_idx on public.plant_health_logs(location_id);
create index if not exists plant_health_logs_event_at_idx on public.plant_health_logs(event_at);

alter table public.plant_health_logs enable row level security;

drop policy if exists tenant_isolation_plant_health_logs on public.plant_health_logs;
create policy tenant_isolation_plant_health_logs on public.plant_health_logs
  for all
  using (public.user_in_org(org_id))
  with check (public.user_in_org(org_id));

-- 2) Ensure attribute_options have default production_status rows for backfill
with orgs as (
  select id from public.organizations
),
defaults as (
  values
    ('Planned', 'Planned', 5, 'growing'),
    ('Incoming', 'Incoming', 10, 'growing'),
    ('Propagation', 'Propagation', 20, 'growing'),
    ('Growing', 'Growing', 30, 'growing'),
    ('Plugs/Liners', 'Plugs/Liners', 40, 'growing'),
    ('Potted', 'Potted', 50, 'growing'),
    ('Ready for Sale', 'Ready for Sale', 60, 'available'),
    ('Looking Good', 'Looking Good', 70, 'available'),
    ('Archived', 'Archived', 1000, 'archived')
)
insert into public.attribute_options (org_id, attribute_key, system_code, display_label, sort_order, is_active, behavior)
select o.id, 'production_status', d.system_code, d.display_label, d.sort_order, true, d.behavior
from orgs o
cross join defaults d
on conflict (org_id, attribute_key, system_code) do nothing;

-- 3) Add status_id to batches and backfill from existing status text
alter table public.batches add column if not exists status_id uuid;

alter table public.batches
  add constraint batches_status_id_fkey
  foreign key (status_id) references public.attribute_options(id);

-- backfill exact/ci match
update public.batches b
set status_id = ao.id
from public.attribute_options ao
where ao.org_id = b.org_id
  and ao.attribute_key = 'production_status'
  and lower(ao.system_code) = lower(b.status)
  and b.status_id is null;

-- fallback to Growing if still missing
update public.batches b
set status_id = ao.id
from public.attribute_options ao
where ao.org_id = b.org_id
  and ao.attribute_key = 'production_status'
  and ao.system_code = 'Growing'
  and b.status_id is null;

alter table public.batches alter column status_id set not null;

create index if not exists batches_status_id_idx on public.batches(status_id);

comment on column public.batches.status_id is 'FK to attribute_options (production_status). Legacy text status column is deprecated.';





