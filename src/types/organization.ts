/**
 * Organization type matching the organizations table schema
 */
export interface Organization {
  id: string;
  name: string;
  country_code: string;
  producer_code: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  vat_number: string | null;
  company_reg_number: string | null;
  bank_name: string | null;
  bank_iban: string | null;
  bank_bic: string | null;
  default_payment_terms: number | null;
  invoice_prefix: string | null;
  invoice_footer_text: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Minimal organization data for display purposes
 */
export interface OrganizationSummary {
  id: string;
  name: string;
  logo_url: string | null;
}
