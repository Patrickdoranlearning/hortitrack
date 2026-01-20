-- Add pre-pricing configuration columns to customers table
-- This allows per-customer control over pre-pricing charges

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS pre_pricing_foc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_pricing_cost_per_label DECIMAL(10,4);

COMMENT ON COLUMN public.customers.pre_pricing_foc IS
  'FOC (Free of Charge) - if true, pre-pricing is free for this customer.';
COMMENT ON COLUMN public.customers.pre_pricing_cost_per_label IS
  'Custom per-label cost for pre-pricing. If NULL, uses organization default from org_fees.';
