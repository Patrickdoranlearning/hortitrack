-- Attribute Options table to support tenant-specific dropdown values
-- and move production phase/status away from hardcoded enums.

-- 1) Core table
create table if not exists public.attribute_options (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  attribute_key text not null,
  system_code text not null,
  display_label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  behavior text, -- optional mapping for system behavior (e.g., available/growing/waste/archived)
  color text, -- optional UI hint
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attribute_options_system_code_nonempty check (char_length(system_code) > 0),
  constraint attribute_options_display_label_nonempty check (char_length(display_label) > 0)
);

create unique index if not exists attribute_options_unique_code
  on public.attribute_options(org_id, attribute_key, system_code);
create index if not exists attribute_options_lookup
  on public.attribute_options(org_id, attribute_key, is_active, sort_order);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger attribute_options_set_updated_at
before update on public.attribute_options
for each row execute function public.set_updated_at();

-- RLS
alter table public.attribute_options enable row level security;

drop policy if exists tenant_isolation_attribute_options on public.attribute_options;
create policy tenant_isolation_attribute_options on public.attribute_options
  for all
  using (public.user_in_org(org_id))
  with check (public.user_in_org(org_id));

-- 2) Relax enums on batches.status/phase to allow custom system codes
alter table public.batches alter column phase drop default;
alter table public.batches alter column phase type text using phase::text;
alter table public.batches alter column phase set default 'propagation';

alter table public.batches alter column status drop default;
alter table public.batches alter column status type text using status::text;
alter table public.batches alter column status set default 'Propagation';

-- Cleanup unused enum types (now stored as text)
drop type if exists production_phase;
drop type if exists production_status;

