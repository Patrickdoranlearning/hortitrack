-- Order Items RRP & Multi-buy Pricing
-- Adds fields to track customer-set retail prices and multi-buy pricing tiers

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS rrp numeric CHECK (rrp IS NULL OR rrp >= 0),
  ADD COLUMN IF NOT EXISTS multibuy_price_2 numeric CHECK (multibuy_price_2 IS NULL OR multibuy_price_2 >= 0),
  ADD COLUMN IF NOT EXISTS multibuy_qty_2 integer CHECK (multibuy_qty_2 IS NULL OR multibuy_qty_2 > 0),
  ADD COLUMN IF NOT EXISTS multibuy_price_3 numeric CHECK (multibuy_price_3 IS NULL OR multibuy_price_3 >= 0),
  ADD COLUMN IF NOT EXISTS multibuy_qty_3 integer CHECK (multibuy_qty_3 IS NULL OR multibuy_qty_3 > 0);

COMMENT ON COLUMN public.order_items.rrp IS 'Recommended retail price set by customer for this line item (B2B portal)';
COMMENT ON COLUMN public.order_items.multibuy_price_2 IS 'Multi-buy tier 1 price (e.g., 3 for €10)';
COMMENT ON COLUMN public.order_items.multibuy_qty_2 IS 'Multi-buy tier 1 quantity threshold';
COMMENT ON COLUMN public.order_items.multibuy_price_3 IS 'Multi-buy tier 2 price (e.g., 6 for €18)';
COMMENT ON COLUMN public.order_items.multibuy_qty_3 IS 'Multi-buy tier 2 quantity threshold';

-- Optionally track which staff member created the order (for impersonation audit trail)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS created_by_staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.orders.created_by_staff_id IS 'Staff user who created this order (populated when created via impersonation)';
