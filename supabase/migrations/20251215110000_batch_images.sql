-- Migration: Add batch_images table for storing multiple photos per batch
-- These photos are taken when updating batch status (growing, saleable, etc.)

begin;

-- Create batch_images table
create table if not exists public.batch_images (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,

  -- Image details
  image_url text not null,
  thumbnail_url text, -- Optional smaller version for thumbnails

  -- Context for the photo
  status_at_capture text, -- The batch status when photo was taken (growing, hardening, saleable, etc.)
  caption text, -- Optional description
  is_hero boolean not null default false, -- Mark as the hero/featured image for B2B display

  -- Metadata
  taken_at timestamptz not null default now(), -- When the photo was actually taken (can differ from created_at)
  taken_by uuid references auth.users(id), -- Who took the photo

  -- Standard timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_batch_images_batch_id on public.batch_images(batch_id);
create index if not exists idx_batch_images_org_id on public.batch_images(org_id);
create index if not exists idx_batch_images_is_hero on public.batch_images(batch_id, is_hero) where is_hero = true;
create index if not exists idx_batch_images_status on public.batch_images(batch_id, status_at_capture);

-- RLS policies
alter table public.batch_images enable row level security;

-- Drop existing policies if they exist (for idempotent migration)
drop policy if exists "batch_images_select_org" on public.batch_images;
drop policy if exists "batch_images_insert_org" on public.batch_images;
drop policy if exists "batch_images_update_org" on public.batch_images;
drop policy if exists "batch_images_delete_org" on public.batch_images;

-- Select: org members can view their org's images
create policy "batch_images_select_org"
  on public.batch_images for select
  using (
    org_id in (
      select org_id from public.org_memberships where user_id = auth.uid()
    )
  );

-- Insert: org members can add images to their org's batches
create policy "batch_images_insert_org"
  on public.batch_images for insert
  with check (
    org_id in (
      select org_id from public.org_memberships where user_id = auth.uid()
    )
  );

-- Update: org members can update their org's images
create policy "batch_images_update_org"
  on public.batch_images for update
  using (
    org_id in (
      select org_id from public.org_memberships where user_id = auth.uid()
    )
  );

-- Delete: org members can delete their org's images
create policy "batch_images_delete_org"
  on public.batch_images for delete
  using (
    org_id in (
      select org_id from public.org_memberships where user_id = auth.uid()
    )
  );

-- Updated_at trigger
drop trigger if exists set_batch_images_updated_at on public.batch_images;
create trigger set_batch_images_updated_at
  before update on public.batch_images
  for each row
  execute function public.set_updated_at();

-- Comment on table
comment on table public.batch_images is 'Photos taken of batches during status updates and growing process';
comment on column public.batch_images.status_at_capture is 'The batch status (growing, hardening, saleable, etc.) when the photo was taken';
comment on column public.batch_images.is_hero is 'If true, this image is featured for B2B customers';

commit;
