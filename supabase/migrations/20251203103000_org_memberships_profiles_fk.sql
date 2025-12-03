-- Link org_memberships.user_id to public.profiles so PostgREST can embed
alter table public.org_memberships
  drop constraint if exists org_memberships_user_id_fkey;

alter table public.org_memberships
  add constraint org_memberships_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

