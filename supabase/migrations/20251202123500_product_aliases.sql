-- Extend SKUs with richer metadata
ALTER TABLE public.skus
  ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sku_type text NOT NULL DEFAULT 'internal';

-- Product aliases for customer-specific naming/sku/pricing
CREATE TABLE public.product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  alias_name text NOT NULL,
  customer_sku_code text,
  customer_barcode text,
  unit_price_ex_vat numeric,
  price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.product_aliases;
CREATE POLICY "Allow all access for authenticated users" ON public.product_aliases
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX product_aliases_product_idx ON public.product_aliases(product_id);
CREATE INDEX product_aliases_customer_idx ON public.product_aliases(customer_id);

