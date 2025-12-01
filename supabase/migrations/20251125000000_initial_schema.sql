-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create USER-DEFINED types (Enums)
create type production_phase as enum ('propagation', 'growing', 'finished');
create type production_status as enum ('Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived');
create type credit_status as enum ('draft', 'issued', 'paid', 'void');
create type delivery_status as enum ('unscheduled', 'scheduled', 'departed', 'delivered', 'cancelled');
create type invoice_status as enum ('draft', 'issued', 'paid', 'void', 'overdue');
create type substitution_status as enum ('requested', 'approved', 'rejected', 'applied');
create type order_status as enum ('draft', 'confirmed', 'processing', 'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled');
create type org_role as enum ('owner', 'admin', 'grower', 'sales', 'viewer');
create type feedback_severity as enum ('info', 'warning', 'critical');
create type resolution_status as enum ('open', 'in_progress', 'resolved', 'wont_fix');
create type size_container_type as enum ('pot', 'tray', 'bareroot');
create type vehicle_type as enum ('van', 'truck', 'trailer');

-- Organizations
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  country_code character NOT NULL DEFAULT 'IE'::bpchar,
  producer_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);

-- Sites
CREATE TABLE public.sites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sites_pkey PRIMARY KEY (id),
  CONSTRAINT sites_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- Nursery Locations
CREATE TABLE public.nursery_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  site_id uuid,
  name text NOT NULL,
  covered boolean NOT NULL DEFAULT false,
  area numeric DEFAULT 0 CHECK (area IS NULL OR area >= 0::numeric),
  nursery_site text NOT NULL, -- Kept from user schema, though site_id might replace it
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nursery_locations_pkey PRIMARY KEY (id),
  CONSTRAINT nursery_locations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT nursery_locations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id)
);

-- Plant Sizes
CREATE TABLE public.plant_sizes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  container_type size_container_type NOT NULL DEFAULT 'pot'::size_container_type,
  cell_multiple integer NOT NULL DEFAULT 1 CHECK (cell_multiple >= 1),
  cell_diameter_mm numeric,
  cell_volume_l numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT plant_sizes_pkey PRIMARY KEY (id)
);

-- Plant Varieties
CREATE TABLE public.plant_varieties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  family text,
  genus text,
  species text,
  category text, -- Changed from USER-DEFINED to text for flexibility or need enum definition
  colour text,
  rating smallint CHECK (rating >= 1 AND rating <= 6),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plant_varieties_pkey PRIMARY KEY (id)
);

-- Suppliers
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  producer_code text,
  country_code character NOT NULL DEFAULT 'IE'::bpchar,
  phone text,
  email text, -- Changed from USER-DEFINED
  address text,
  eircode text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id),
  CONSTRAINT suppliers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- Price Lists
CREATE TABLE public.price_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  currency character NOT NULL DEFAULT 'EUR'::bpchar,
  is_default boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_to date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT price_lists_pkey PRIMARY KEY (id),
  CONSTRAINT price_lists_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- Customers
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  code text,
  name text NOT NULL,
  email text, -- Changed from USER-DEFINED
  phone text,
  vat_number text,
  notes text,
  default_price_list_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT fk_customers_price_list FOREIGN KEY (default_price_list_id) REFERENCES public.price_lists(id)
);

-- Customer Addresses
CREATE TABLE public.customer_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  label text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text,
  county text,
  eircode text,
  country_code character NOT NULL DEFAULT 'IE'::bpchar,
  is_default_shipping boolean NOT NULL DEFAULT false,
  is_default_billing boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_addresses_pkey PRIMARY KEY (id),
  CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

-- Customer Contacts
CREATE TABLE public.customer_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  name text NOT NULL,
  email text, -- Changed from USER-DEFINED
  phone text,
  role text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_contacts_pkey PRIMARY KEY (id),
  CONSTRAINT customer_contacts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

-- Batches
CREATE TABLE public.batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  batch_number text NOT NULL,
  phase production_phase NOT NULL DEFAULT 'propagation'::production_phase,
  supplier_id uuid,
  plant_variety_id uuid NOT NULL,
  size_id uuid NOT NULL,
  location_id uuid NOT NULL,
  status production_status NOT NULL DEFAULT 'Propagation'::production_status, -- Adjusted default to match enum
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  initial_quantity integer CHECK (initial_quantity IS NULL OR initial_quantity >= 0),
  quantity_produced integer,
  unit text NOT NULL DEFAULT 'plants'::text,
  planted_at date,
  ready_at date,
  dispatched_at date,
  archived_at timestamp with time zone,
  qr_code text,
  qr_image_url text,
  passport_override_a text,
  passport_override_b text,
  passport_override_c text,
  passport_override_d text,
  log_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  supplier_batch_number text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT batches_pkey PRIMARY KEY (id),
  CONSTRAINT batches_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id),
  CONSTRAINT batches_plant_variety_id_fkey FOREIGN KEY (plant_variety_id) REFERENCES public.plant_varieties(id),
  CONSTRAINT batches_size_id_fkey FOREIGN KEY (size_id) REFERENCES public.plant_sizes(id),
  CONSTRAINT batches_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.nursery_locations(id)
);

-- Batch Logs
CREATE TABLE public.batch_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  type text NOT NULL,
  note text,
  qty_change integer,
  actor_id text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT batch_logs_pkey PRIMARY KEY (id),
  CONSTRAINT batch_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT batch_logs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id)
);

-- SKUs
CREATE TABLE public.skus (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  code text NOT NULL,
  plant_variety_id uuid NOT NULL,
  size_id uuid NOT NULL,
  description text,
  barcode text,
  default_vat_rate numeric NOT NULL DEFAULT 13.5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT skus_pkey PRIMARY KEY (id),
  CONSTRAINT skus_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT skus_plant_variety_id_fkey FOREIGN KEY (plant_variety_id) REFERENCES public.plant_varieties(id),
  CONSTRAINT skus_size_id_fkey FOREIGN KEY (size_id) REFERENCES public.plant_sizes(id)
);

-- Orders
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  order_number text NOT NULL,
  customer_id uuid NOT NULL,
  ship_to_address_id uuid,
  status order_status NOT NULL DEFAULT 'draft'::order_status,
  payment_status text,
  requested_delivery_date date,
  notes text,
  subtotal_ex_vat numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_inc_vat numeric NOT NULL DEFAULT 0,
  trolleys_estimated integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT orders_ship_to_address_id_fkey FOREIGN KEY (ship_to_address_id) REFERENCES public.customer_addresses(id)
);

-- Order Items
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  sku_id uuid NOT NULL,
  description text,
  quantity integer NOT NULL CHECK (quantity >= 0),
  unit_price_ex_vat numeric NOT NULL CHECK (unit_price_ex_vat >= 0::numeric),
  vat_rate numeric NOT NULL CHECK (vat_rate >= 0::numeric AND vat_rate <= 100::numeric),
  discount_pct numeric NOT NULL DEFAULT 0 CHECK (discount_pct >= 0::numeric AND discount_pct <= 100::numeric),
  line_total_ex_vat numeric NOT NULL DEFAULT 0,
  line_vat_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id)
);

-- Invoices
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  order_id uuid,
  invoice_number text NOT NULL,
  currency character NOT NULL DEFAULT 'EUR'::bpchar,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status invoice_status NOT NULL DEFAULT 'draft'::invoice_status,
  notes text,
  subtotal_ex_vat numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_inc_vat numeric NOT NULL DEFAULT 0,
  amount_credited numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);

-- Invoice Items
CREATE TABLE public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  order_item_id uuid,
  sku_id uuid,
  description text,
  quantity integer NOT NULL CHECK (quantity >= 0),
  unit_price_ex_vat numeric NOT NULL CHECK (unit_price_ex_vat >= 0::numeric),
  vat_rate numeric NOT NULL CHECK (vat_rate >= 0::numeric AND vat_rate <= 100::numeric),
  discount_pct numeric NOT NULL DEFAULT 0 CHECK (discount_pct >= 0::numeric AND discount_pct <= 100::numeric),
  line_total_ex_vat numeric NOT NULL DEFAULT 0,
  line_vat_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invoice_items_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT invoice_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id),
  CONSTRAINT invoice_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id)
);

-- Profiles (Users)
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  display_name text,
  email text, -- Changed from USER-DEFINED
  active_org_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_active_org_id_fkey FOREIGN KEY (active_org_id) REFERENCES public.organizations(id)
);

-- Org Memberships
CREATE TABLE public.org_memberships (
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role org_role NOT NULL DEFAULT 'viewer'::org_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT org_memberships_pkey PRIMARY KEY (org_id, user_id),
  CONSTRAINT org_memberships_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT org_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Enable RLS
alter table public.organizations enable row level security;
alter table public.sites enable row level security;
alter table public.nursery_locations enable row level security;
alter table public.plant_sizes enable row level security;
alter table public.plant_varieties enable row level security;
alter table public.suppliers enable row level security;
alter table public.price_lists enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.batches enable row level security;
alter table public.batch_logs enable row level security;
alter table public.skus enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.profiles enable row level security;
alter table public.org_memberships enable row level security;

-- Basic RLS Policy (Allow all for now, refine later)
create policy "Allow all access for authenticated users" on public.organizations for all using (auth.role() = 'authenticated');
-- Repeat for other tables as needed or implement org-based RLS

-- Rate Limits (Simple implementation)
CREATE TABLE public.rate_limits (
  key text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  expire_at bigint NOT NULL,
  CONSTRAINT rate_limits_pkey PRIMARY KEY (key)
);

-- Idempotency Keys
CREATE TABLE public.idempotency_keys (
  key text NOT NULL,
  response_body jsonb,
  status_code integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key)
);

alter table public.rate_limits enable row level security;
alter table public.idempotency_keys enable row level security;
