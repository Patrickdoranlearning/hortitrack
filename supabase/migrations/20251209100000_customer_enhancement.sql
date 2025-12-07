-- Customer enhancement: addresses, contacts, multi-currency, RRP pricing

-- =============================================================================
-- 1. Extend customers table with currency, country, payment terms
-- =============================================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS country_code char(2) NOT NULL DEFAULT 'IE',
  ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS credit_limit numeric,
  ADD COLUMN IF NOT EXISTS account_code text;

-- Add comment for VAT treatment reference
COMMENT ON COLUMN public.customers.country_code IS 'IE=Ireland, GB=UK, XI=Northern Ireland, NL=Netherlands - determines VAT treatment';

-- =============================================================================
-- 2. Extend customer_addresses with store name and contact details
-- =============================================================================
ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- Drop dependent view before altering column
DROP VIEW IF EXISTS public.v_delivery_note_header;

-- Expand country_code to support full 2-char codes (was bpchar(1))
ALTER TABLE public.customer_addresses
  ALTER COLUMN country_code TYPE char(2) USING CASE 
    WHEN country_code = 'I' THEN 'IE'
    WHEN country_code = 'G' THEN 'GB'
    WHEN country_code = 'N' THEN 'NL'
    ELSE 'IE'
  END;

-- Recreate view
CREATE OR REPLACE VIEW public.v_delivery_note_header AS
SELECT d.id AS delivery_id,
    d.org_id,
    d.scheduled_date,
    d.status AS delivery_status,
    d.method,
    d.trolley_count,
    v.name AS vehicle_name,
    o.id AS order_id,
    o.order_number,
    c.name AS customer_name,
    ca.label AS ship_label,
    ca.line1 AS ship_line1,
    ca.line2 AS ship_line2,
    ca.city AS ship_city,
    ca.county AS ship_county,
    ca.eircode AS ship_eircode,
    ca.country_code AS ship_country
   FROM deliveries d
     JOIN orders o ON o.id = d.order_id
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN customer_addresses ca ON ca.id = o.ship_to_address_id
     LEFT JOIN vehicles v ON v.id = d.vehicle_id;

-- Add index for efficient address lookups
CREATE INDEX IF NOT EXISTS customer_addresses_customer_idx 
  ON public.customer_addresses(customer_id);

-- =============================================================================
-- 3. Extend product_aliases with RRP (recommended retail price)
-- =============================================================================
ALTER TABLE public.product_aliases
  ADD COLUMN IF NOT EXISTS rrp numeric CHECK (rrp IS NULL OR rrp >= 0);

COMMENT ON COLUMN public.product_aliases.rrp IS 'Recommended retail price - what the customer charges end consumers (for pre-pricing labels)';

-- =============================================================================
-- 4. Add mobile phone to customer_contacts for completeness
-- =============================================================================
ALTER TABLE public.customer_contacts
  ADD COLUMN IF NOT EXISTS mobile text;

-- =============================================================================
-- 5. Enable RLS on customer_addresses and customer_contacts if not already
-- =============================================================================
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_addresses' 
    AND policyname = 'Allow all access for authenticated users'
  ) THEN
    CREATE POLICY "Allow all access for authenticated users" 
      ON public.customer_addresses
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_contacts' 
    AND policyname = 'Allow all access for authenticated users'
  ) THEN
    CREATE POLICY "Allow all access for authenticated users" 
      ON public.customer_contacts
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- =============================================================================
-- 6. Create a view for VAT treatment lookup
-- =============================================================================
CREATE OR REPLACE VIEW public.customer_vat_treatment AS
SELECT 
  c.id AS customer_id,
  c.name AS customer_name,
  c.country_code,
  c.vat_number,
  c.currency,
  CASE 
    WHEN c.country_code = 'IE' THEN 'standard'
    WHEN c.country_code = 'GB' AND c.vat_number IS NOT NULL THEN 'zero_rated_export'
    WHEN c.country_code = 'GB' AND c.vat_number IS NULL THEN 'standard_export'
    WHEN c.country_code = 'XI' THEN 'northern_ireland_eu'
    WHEN c.country_code = 'NL' AND c.vat_number IS NOT NULL THEN 'reverse_charge'
    WHEN c.country_code = 'NL' AND c.vat_number IS NULL THEN 'standard_export'
    ELSE 'standard'
  END AS vat_treatment,
  CASE 
    WHEN c.country_code = 'IE' THEN 'Apply Irish VAT rates'
    WHEN c.country_code = 'GB' AND c.vat_number IS NOT NULL THEN 'Zero-rated B2B export to UK'
    WHEN c.country_code = 'GB' AND c.vat_number IS NULL THEN 'Export to UK (B2C)'
    WHEN c.country_code = 'XI' THEN 'Northern Ireland - EU goods rules apply'
    WHEN c.country_code = 'NL' AND c.vat_number IS NOT NULL THEN 'Reverse charge - customer accounts for VAT'
    WHEN c.country_code = 'NL' AND c.vat_number IS NULL THEN 'Export to NL (B2C)'
    ELSE 'Apply standard VAT rates'
  END AS vat_description
FROM public.customers c;

COMMENT ON VIEW public.customer_vat_treatment IS 'Lookup view for determining VAT treatment based on customer country and VAT registration';

