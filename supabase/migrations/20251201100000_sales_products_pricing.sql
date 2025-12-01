-- Sales module structural additions

-- Invoice numbering sequence starting at 200000
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq
    START WITH 200000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Ensure invoices use the sequence by default
ALTER TABLE public.invoices
    ALTER COLUMN invoice_number SET DEFAULT nextval('public.invoice_number_seq')::text;

-- Align sequence with existing numeric invoices if present
SELECT setval(
    'public.invoice_number_seq',
    GREATEST(
        200000,
        COALESCE(
            (
                SELECT MAX(invoice_number::bigint)
                FROM public.invoices
                WHERE invoice_number ~ '^[0-9]+$'
            ),
            199999
        )
    ),
    true
);

-- Products (1:1 with skus)
CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    sku_id uuid NOT NULL UNIQUE REFERENCES public.skus(id),
    name text NOT NULL,
    description text,
    default_status text,
    hero_image_url text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- link order items to products for traceability
ALTER TABLE public.order_items
    ADD COLUMN product_id uuid REFERENCES public.products(id);

-- Batches that can fulfill a product
CREATE TABLE public.product_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    available_quantity_override integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (product_id, batch_id)
);

-- Customer-specific pricing per product
CREATE TABLE public.product_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    price_list_id uuid NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
    unit_price_ex_vat numeric NOT NULL CHECK (unit_price_ex_vat >= 0),
    currency char(3) NOT NULL DEFAULT 'EUR',
    valid_from date,
    valid_to date,
    min_qty integer NOT NULL DEFAULT 1 CHECK (min_qty > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Additional mapping for customers to price lists (overrides)
CREATE TABLE public.price_list_customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    price_list_id uuid NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    valid_from date,
    valid_to date,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_prices_effective_range_idx
    ON public.product_prices (
        product_id,
        price_list_id,
        COALESCE(valid_from, DATE '0001-01-01'),
        COALESCE(valid_to, DATE '9999-12-31')
    );

CREATE UNIQUE INDEX price_list_customers_effective_range_idx
    ON public.price_list_customers (
        price_list_id,
        customer_id,
        COALESCE(valid_from, DATE '0001-01-01'),
        COALESCE(valid_to, DATE '9999-12-31')
    );

-- Order lifecycle / audit trail
CREATE TABLE public.order_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    description text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Exceptions that block dispatch
CREATE TABLE public.order_exceptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
    exception_type text NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    notes text,
    raised_by uuid REFERENCES auth.users(id),
    resolved_by uuid REFERENCES auth.users(id),
    resolved_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS for new tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_exceptions ENABLE ROW LEVEL SECURITY;

-- Temporary permissive policies (to be refined per org)
CREATE POLICY "Allow all access for authenticated users" ON public.products
    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.product_batches
    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.product_prices
    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.price_list_customers
    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.order_events
    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.order_exceptions
    FOR ALL USING (auth.role() = 'authenticated');

