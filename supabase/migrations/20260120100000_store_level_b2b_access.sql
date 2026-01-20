-- Store-Level B2B Portal Access
-- Enables individual stores/addresses to have their own B2B portal users
-- Users with customer_address_id set can only access orders for their store

-- Add customer_address_id to profiles for store-level access control
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS customer_address_id uuid
    REFERENCES public.customer_addresses(id) ON DELETE SET NULL;

-- Create index for performance on address-restricted user lookups
CREATE INDEX IF NOT EXISTS profiles_customer_address_id_idx
  ON public.profiles(customer_address_id)
  WHERE customer_address_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.customer_address_id IS
  'Optional: Links store-level portal users to a specific address/store. NULL means user has access to all customer addresses (head office access).';

-- Validation trigger to ensure address belongs to the linked customer
CREATE OR REPLACE FUNCTION public.validate_profile_address_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If customer_address_id is set, validate it belongs to the customer
  IF NEW.customer_address_id IS NOT NULL THEN
    IF NEW.customer_id IS NULL THEN
      RAISE EXCEPTION 'customer_address_id requires customer_id to be set';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.customer_addresses
      WHERE id = NEW.customer_address_id
        AND customer_id = NEW.customer_id
    ) THEN
      RAISE EXCEPTION 'customer_address_id must belong to the linked customer';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trg_profiles_validate_address_customer ON public.profiles;

CREATE TRIGGER trg_profiles_validate_address_customer
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_address_customer();

-- Add created_by_user_id to orders for tracking which B2B user created an order
-- This is needed to filter orders for store-level users (they only see their own orders)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_created_by_user_id_idx
  ON public.orders(created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;

COMMENT ON COLUMN public.orders.created_by_user_id IS
  'The B2B portal user who created this order. Used for store-level access control.';
