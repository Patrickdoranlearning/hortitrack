-- ================================================
-- ADD FK FROM customer_interactions.user_id TO profiles.id
-- ================================================
-- This enables PostgREST to detect the relationship for embedded joins
-- The profiles.id matches auth.users.id (standard Supabase pattern)

ALTER TABLE public.customer_interactions
ADD CONSTRAINT customer_interactions_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add comment for documentation
COMMENT ON CONSTRAINT customer_interactions_user_id_profiles_fkey ON public.customer_interactions
IS 'Links interaction to profile for PostgREST embedded joins';
