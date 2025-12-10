begin;

alter table public.batches
  add column if not exists grower_photo_url text,
  add column if not exists sales_photo_url text;

comment on column public.batches.grower_photo_url is 'Latest grower-provided photo URL for internal use';
comment on column public.batches.sales_photo_url is 'Customer-facing hero photo URL';

commit;



