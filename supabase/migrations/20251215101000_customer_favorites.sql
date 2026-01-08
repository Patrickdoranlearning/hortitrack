-- Customer Favorite Products
-- Allows customers to save favorite products for quick reordering

CREATE TABLE IF NOT EXISTS public.customer_favorite_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

CREATE INDEX customer_favorite_products_customer_idx ON public.customer_favorite_products(customer_id);
CREATE INDEX customer_favorite_products_product_idx ON public.customer_favorite_products(product_id);
CREATE INDEX customer_favorite_products_org_idx ON public.customer_favorite_products(org_id);

COMMENT ON TABLE public.customer_favorite_products IS 'Customer favorite products for quick reordering in B2B portal';

-- Enable Row Level Security
ALTER TABLE public.customer_favorite_products ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Customers can only manage their own favorites
CREATE POLICY "Customers can manage their own favorites"
  ON public.customer_favorite_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.customer_id = customer_favorite_products.customer_id
        AND profiles.portal_role = 'customer'
    )
    OR
    -- Allow impersonating staff to manage favorites
    EXISTS (
      SELECT 1 FROM public.customer_impersonation_sessions cis
      WHERE cis.staff_user_id = auth.uid()
        AND cis.customer_id = customer_favorite_products.customer_id
        AND cis.ended_at IS NULL
    )
  );
