-- Migration: Add photo_type to batch_images and ability to promote to product hero
-- Growing photos are internal/progress photos
-- Sales photos are customer-facing and can be promoted to product hero images

begin;

-- Add photo_type column to distinguish growing vs sales photos
alter table public.batch_images
  add column if not exists photo_type text not null default 'growing';

-- Add check constraint for valid photo types
alter table public.batch_images
  drop constraint if exists batch_images_photo_type_check;

alter table public.batch_images
  add constraint batch_images_photo_type_check
  check (photo_type in ('growing', 'sales'));

-- Add index for filtering by photo type
create index if not exists idx_batch_images_photo_type
  on public.batch_images(batch_id, photo_type);

-- Add column to track if this image was promoted to a product
-- When a batch photo is set as a product hero, we track the link here
alter table public.batch_images
  add column if not exists promoted_to_product_id uuid references public.products(id) on delete set null;

-- Add index for promoted images
create index if not exists idx_batch_images_promoted_product
  on public.batch_images(promoted_to_product_id) where promoted_to_product_id is not null;

-- Comments
comment on column public.batch_images.photo_type is 'Type of photo: growing (internal/progress) or sales (customer-facing)';
comment on column public.batch_images.promoted_to_product_id is 'If this image was promoted to a product hero image, links to that product';

commit;
