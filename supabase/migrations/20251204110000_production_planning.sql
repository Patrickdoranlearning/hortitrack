-- Production Planning & Protocol Support

-- 1. Extend the production_status enum for ghost/incoming batches
alter type production_status add value if not exists 'Incoming';
alter type production_status add value if not exists 'Planned';

-- 2. Parent batch linkage to support future splits/allocations
alter table public.batches
  add column if not exists parent_batch_id uuid references public.batches(id);

create index if not exists batches_parent_batch_id_idx
  on public.batches(parent_batch_id);

-- 3. Protocols (production recipes) table
create table if not exists public.protocols (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null,
  description text,
  target_variety_id uuid references public.plant_varieties(id),
  target_size_id uuid references public.plant_sizes(id),
  definition jsonb not null default '{}'::jsonb,
  route jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protocols_pkey primary key (id)
);

create index if not exists protocols_org_id_idx on public.protocols(org_id);
create index if not exists protocols_target_idx on public.protocols(target_variety_id, target_size_id);

alter table public.protocols enable row level security;

drop policy if exists "Users can view org protocols" on public.protocols;
create policy "Users can view org protocols"
on public.protocols
for select
using (
  org_id in (
    select org_id from public.org_memberships where user_id = auth.uid()
  )
);

drop policy if exists "Users can manage org protocols" on public.protocols;
create policy "Users can manage org protocols"
on public.protocols
for all
using (
  org_id in (
    select org_id from public.org_memberships where user_id = auth.uid()
  )
)
with check (
  org_id in (
    select org_id from public.org_memberships where user_id = auth.uid()
  )
);

-- 4. Optional protocol linkage on batches for planning context
alter table public.batches
  add column if not exists protocol_id uuid references public.protocols(id);

create index if not exists batches_protocol_id_idx
  on public.batches(protocol_id);
