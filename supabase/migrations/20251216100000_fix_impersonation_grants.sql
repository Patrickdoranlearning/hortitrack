-- Grant permissions on customer_impersonation_sessions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_impersonation_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_impersonation_sessions TO service_role;

-- Also grant on other B2B tables that may be missing grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_favorite_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_favorite_products TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_resources TO service_role;



