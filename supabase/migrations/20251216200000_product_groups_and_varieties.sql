-- Product Groups & Varieties Migration
-- Enables:
-- 1. Products to have multiple varieties (e.g., "2L Lavender" → Hidcote, Munstead)
-- 2. Product Groups with rule-based + manual membership (e.g., "2L Perennial" → multiple products)
-- 3. Customer-specific aliases for groups
-- 4. Order fulfillment preferences (WhatsApp breakdown requests)

--------------------------------------------------------------------------------
-- 1. PRODUCT VARIETIES (many-to-many: products ↔ varieties)
--------------------------------------------------------------------------------
CREATE TABLE public.product_varieties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variety_id uuid NOT NULL REFERENCES public.plant_varieties(id) ON DELETE CASCADE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (product_id, variety_id)
);

CREATE INDEX idx_product_varieties_product ON public.product_varieties(product_id);
CREATE INDEX idx_product_varieties_variety ON public.product_varieties(variety_id);
CREATE INDEX idx_product_varieties_org ON public.product_varieties(org_id);

--------------------------------------------------------------------------------
-- 2. PRODUCT GROUPS (with rule-based matching)
--------------------------------------------------------------------------------
CREATE TABLE public.product_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    name text NOT NULL,
    description text,
    default_barcode text,

    -- Rule-based matching (all nullable - only set what you want to match)
    match_category text,           -- e.g., "Perennial"
    match_family text,             -- e.g., "Lamiaceae"
    match_genus text,              -- e.g., "Lavandula"
    match_size_id uuid REFERENCES public.plant_sizes(id),

    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_groups_org ON public.product_groups(org_id);
CREATE INDEX idx_product_groups_match_category ON public.product_groups(match_category) WHERE match_category IS NOT NULL;
CREATE INDEX idx_product_groups_match_size ON public.product_groups(match_size_id) WHERE match_size_id IS NOT NULL;

--------------------------------------------------------------------------------
-- 3. PRODUCT GROUP MEMBERS (manual include/exclude overrides)
--------------------------------------------------------------------------------
CREATE TYPE product_group_inclusion_type AS ENUM ('auto', 'manual_include', 'manual_exclude');

CREATE TABLE public.product_group_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    group_id uuid NOT NULL REFERENCES public.product_groups(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    inclusion_type product_group_inclusion_type NOT NULL DEFAULT 'manual_include',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, product_id)
);

CREATE INDEX idx_product_group_members_group ON public.product_group_members(group_id);
CREATE INDEX idx_product_group_members_product ON public.product_group_members(product_id);
CREATE INDEX idx_product_group_members_org ON public.product_group_members(org_id);

--------------------------------------------------------------------------------
-- 4. PRODUCT GROUP ALIASES (customer-specific naming/barcodes for groups)
--------------------------------------------------------------------------------
CREATE TABLE public.product_group_aliases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    group_id uuid NOT NULL REFERENCES public.product_groups(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    alias_name text NOT NULL,
    customer_sku_code text,
    customer_barcode text,
    unit_price_ex_vat numeric CHECK (unit_price_ex_vat IS NULL OR unit_price_ex_vat >= 0),
    rrp numeric CHECK (rrp IS NULL OR rrp >= 0),
    price_list_id uuid REFERENCES public.price_lists(id),
    is_active boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_group_aliases_group ON public.product_group_aliases(group_id);
CREATE INDEX idx_product_group_aliases_customer ON public.product_group_aliases(customer_id);
CREATE INDEX idx_product_group_aliases_org ON public.product_group_aliases(org_id);

--------------------------------------------------------------------------------
-- 5. UPDATE ORDER_ITEMS to support product_group_id
--------------------------------------------------------------------------------
ALTER TABLE public.order_items
    ADD COLUMN product_group_id uuid REFERENCES public.product_groups(id);

-- Add check: either product_id or product_group_id should be set (or existing variety-based logic)
COMMENT ON COLUMN public.order_items.product_group_id IS 'When customer orders at group level (e.g., "2L Perennial"), store the group reference here';

CREATE INDEX idx_order_items_product_group ON public.order_items(product_group_id) WHERE product_group_id IS NOT NULL;

--------------------------------------------------------------------------------
-- 6. ORDER ITEM PREFERENCES (fulfillment breakdown from WhatsApp/email requests)
--------------------------------------------------------------------------------
CREATE TABLE public.order_item_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,

    -- What customer requested (one of these should be set)
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    variety_id uuid REFERENCES public.plant_varieties(id) ON DELETE SET NULL,

    requested_qty integer NOT NULL CHECK (requested_qty > 0),
    fulfilled_qty integer DEFAULT 0 CHECK (fulfilled_qty >= 0),

    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT preference_has_target CHECK (product_id IS NOT NULL OR variety_id IS NOT NULL)
);

CREATE INDEX idx_order_item_preferences_order_item ON public.order_item_preferences(order_item_id);
CREATE INDEX idx_order_item_preferences_product ON public.order_item_preferences(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_order_item_preferences_variety ON public.order_item_preferences(variety_id) WHERE variety_id IS NOT NULL;
CREATE INDEX idx_order_item_preferences_org ON public.order_item_preferences(org_id);

--------------------------------------------------------------------------------
-- 7. HELPER FUNCTION: Get all products in a group (rules + overrides)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_group_members(p_group_id uuid)
RETURNS TABLE (
    product_id uuid,
    product_name text,
    inclusion_source text  -- 'rule' or 'manual_include'
)
LANGUAGE sql
STABLE
AS $$
    WITH group_rules AS (
        SELECT match_category, match_family, match_genus, match_size_id, org_id
        FROM public.product_groups
        WHERE id = p_group_id
    ),
    rule_matched AS (
        -- Products matching the group's rules
        SELECT DISTINCT
            p.id AS product_id,
            p.name AS product_name,
            'rule' AS inclusion_source
        FROM public.products p
        JOIN public.skus s ON s.id = p.sku_id
        LEFT JOIN public.plant_varieties pv ON pv.id = s.plant_variety_id
        CROSS JOIN group_rules gr
        WHERE p.org_id = gr.org_id
          AND p.is_active = true
          AND (gr.match_category IS NULL OR pv.category = gr.match_category)
          AND (gr.match_family IS NULL OR pv.family = gr.match_family)
          AND (gr.match_genus IS NULL OR pv.genus = gr.match_genus)
          AND (gr.match_size_id IS NULL OR s.size_id = gr.match_size_id)
    ),
    manual_included AS (
        -- Manually included products
        SELECT
            pgm.product_id,
            p.name AS product_name,
            'manual_include' AS inclusion_source
        FROM public.product_group_members pgm
        JOIN public.products p ON p.id = pgm.product_id
        WHERE pgm.group_id = p_group_id
          AND pgm.inclusion_type = 'manual_include'
    ),
    manual_excluded AS (
        -- Get IDs to exclude
        SELECT product_id
        FROM public.product_group_members
        WHERE group_id = p_group_id
          AND inclusion_type = 'manual_exclude'
    )
    -- Combine: (rule matches - exclusions) + manual includes
    SELECT product_id, product_name, inclusion_source FROM rule_matched
    WHERE product_id NOT IN (SELECT product_id FROM manual_excluded)
    UNION
    SELECT product_id, product_name, inclusion_source FROM manual_included;
$$;

--------------------------------------------------------------------------------
-- 8. RLS POLICIES
--------------------------------------------------------------------------------
ALTER TABLE public.product_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_group_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_preferences ENABLE ROW LEVEL SECURITY;

-- Product Varieties
CREATE POLICY "Users can view product_varieties in their org" ON public.product_varieties
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage product_varieties in their org" ON public.product_varieties
    FOR ALL USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    );

-- Product Groups
CREATE POLICY "Users can view product_groups in their org" ON public.product_groups
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage product_groups in their org" ON public.product_groups
    FOR ALL USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    );

-- Product Group Members
CREATE POLICY "Users can view product_group_members in their org" ON public.product_group_members
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage product_group_members in their org" ON public.product_group_members
    FOR ALL USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    );

-- Product Group Aliases
CREATE POLICY "Users can view product_group_aliases in their org" ON public.product_group_aliases
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage product_group_aliases in their org" ON public.product_group_aliases
    FOR ALL USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    );

-- Order Item Preferences
CREATE POLICY "Users can view order_item_preferences in their org" ON public.order_item_preferences
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage order_item_preferences in their org" ON public.order_item_preferences
    FOR ALL USING (
        org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
    );

--------------------------------------------------------------------------------
-- 9. GRANTS FOR SERVICE ROLE
--------------------------------------------------------------------------------
GRANT ALL ON public.product_varieties TO service_role;
GRANT ALL ON public.product_groups TO service_role;
GRANT ALL ON public.product_group_members TO service_role;
GRANT ALL ON public.product_group_aliases TO service_role;
GRANT ALL ON public.order_item_preferences TO service_role;
GRANT EXECUTE ON FUNCTION public.get_product_group_members(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_product_group_members(uuid) TO authenticated;
