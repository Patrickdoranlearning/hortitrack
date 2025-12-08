-- Add business/financial details to organizations table
-- These fields are used on invoices, dockets, and other business documents

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS vat_number text,
ADD COLUMN IF NOT EXISTS company_reg_number text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_iban text,
ADD COLUMN IF NOT EXISTS bank_bic text,
ADD COLUMN IF NOT EXISTS default_payment_terms integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV',
ADD COLUMN IF NOT EXISTS invoice_footer_text text,
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS address text;

-- Add comments for documentation
COMMENT ON COLUMN public.organizations.vat_number IS 'VAT/Tax registration number';
COMMENT ON COLUMN public.organizations.company_reg_number IS 'Company registration number';
COMMENT ON COLUMN public.organizations.bank_name IS 'Bank name for payment information';
COMMENT ON COLUMN public.organizations.bank_iban IS 'Bank IBAN for payments';
COMMENT ON COLUMN public.organizations.bank_bic IS 'Bank BIC/SWIFT code';
COMMENT ON COLUMN public.organizations.default_payment_terms IS 'Default payment terms in days';
COMMENT ON COLUMN public.organizations.invoice_prefix IS 'Prefix for invoice numbers';
COMMENT ON COLUMN public.organizations.invoice_footer_text IS 'Custom text to appear at bottom of invoices';

