insert into storage.buckets (id, name, public)
values ('batch-photos', 'batch-photos', true)
on conflict (id) do nothing;

create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'batch-photos' );

create policy "Authenticated Upload"
on storage.objects for insert
with check ( bucket_id = 'batch-photos' and auth.role() = 'authenticated' );

create policy "Authenticated Update"
on storage.objects for update
using ( bucket_id = 'batch-photos' and auth.role() = 'authenticated' );

