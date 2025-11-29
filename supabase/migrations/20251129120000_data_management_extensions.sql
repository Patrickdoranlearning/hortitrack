-- Data Management extensions to support richer golden tables

-- Plant sizes: capture tray dimensions and shape metadata
alter table public.plant_sizes
  add column if not exists cell_width_mm numeric,
  add column if not exists cell_length_mm numeric,
  add column if not exists cell_shape text;

-- Plant varieties: additional descriptive and compliance metadata
alter table public.plant_varieties
  add column if not exists common_name text,
  add column if not exists grouping text,
  add column if not exists flowering_period text,
  add column if not exists evergreen boolean default false,
  add column if not exists plant_breeders_rights boolean default false;

-- Nursery locations: explicit type (Tunnel, Glasshouse, etc.)
alter table public.nursery_locations
  add column if not exists type text;

-- Suppliers: classify supplier type (plants, haulier, hardware, etc.)
alter table public.suppliers
  add column if not exists supplier_type text;

-- Customers: store/chain metadata and finance contacts
alter table public.customers
  add column if not exists store text,
  add column if not exists accounts_email text,
  add column if not exists pricing_tier text;

-- Hauliers master table
create table if not exists public.hauliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null,
  phone text,
  email text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hauliers enable row level security;

create policy "Authenticated users can manage hauliers"
  on public.hauliers
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

