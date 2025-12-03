-- Add full_name to profiles to match application queries
alter table public.profiles
  add column if not exists full_name text;

