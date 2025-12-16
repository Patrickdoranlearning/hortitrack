-- Grant permissions for product groups tables to authenticated users
-- The RLS policies handle org-level security, these grants enable table access

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_varieties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_group_aliases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_preferences TO authenticated;

-- Grant usage on the enum type
GRANT USAGE ON TYPE public.product_group_inclusion_type TO authenticated;

-- Grant execute on the helper function
GRANT EXECUTE ON FUNCTION public.get_product_group_members(uuid) TO authenticated;
