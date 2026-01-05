-- Delivery preferences for customers (trolley type, labels, instructions)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS delivery_preferences jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.customers.delivery_preferences IS
  'Customer-specific delivery requirements: trolley_type, label_requirements, special_instructions';


