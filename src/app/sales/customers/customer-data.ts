import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { CustomerSummary, CustomerManagementPayload, CustomerAddressSummary, CustomerContactSummary } from "./types";

type SupabaseServerClient = SupabaseClient<Database>;

export type CustomerRow = {
  id: string;
  org_id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  notes: string | null;
  default_price_list_id: string | null;
  store: string | null;
  accounts_email: string | null;
  pricing_tier: string | null;
  created_at: string | null;
  // New fields
  currency: string;
  country_code: string;
  payment_terms_days: number;
  credit_limit: number | null;
  account_code: string | null;
  requires_pre_pricing: boolean;
  // Relations
  price_lists: { id: string; name: string } | null;
  price_list_customers: Array<{
    id: string;
    price_list_id: string;
    valid_from: string | null;
    valid_to: string | null;
    price_lists: { id: string; name: string } | null;
  }> | null;
  customer_addresses: Array<{
    id: string;
    label: string;
    store_name: string | null;
    line1: string;
    line2: string | null;
    city: string | null;
    county: string | null;
    eircode: string | null;
    country_code: string;
    is_default_shipping: boolean;
    is_default_billing: boolean;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
  }> | null;
  customer_contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    role: string | null;
    is_primary: boolean;
  }> | null;
};

export type ProductOption = {
  id: string;
  name: string;
  sku_code: string | null;
};

export async function fetchCustomerManagementData(
  supabase: SupabaseServerClient,
  orgId: string
): Promise<{ 
  customerRows: CustomerRow[]; 
  priceLists: Array<{ id: string; name: string; currency: string; is_default: boolean | null }>;
  products: ProductOption[];
}> {
  console.log("[fetchCustomerManagementData] Fetching for orgId:", orgId);
  const [customerRows, priceListRows, productRows] = await Promise.all([
    supabase
      .from("customers")
      .select(
        `
        id,
        org_id,
        name,
        code,
        email,
        phone,
        vat_number,
        notes,
        default_price_list_id,
        store,
        accounts_email,
        pricing_tier,
        created_at,
        currency,
        country_code,
        payment_terms_days,
        credit_limit,
        account_code,
        requires_pre_pricing,
        price_lists ( id, name ),
        price_list_customers (
          id,
          price_list_id,
          valid_from,
          valid_to,
          price_lists ( id, name )
        ),
        customer_addresses (
          id,
          label,
          store_name,
          line1,
          line2,
          city,
          county,
          eircode,
          country_code,
          is_default_shipping,
          is_default_billing,
          contact_name,
          contact_email,
          contact_phone
        ),
        customer_contacts (
          id,
          name,
          email,
          phone,
          mobile,
          role,
          is_primary
        )
      `
      )
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .then((res) => {
        if (res.error) {
          console.error("[fetchCustomerManagementData] customers error:", res.error);
        }
        console.log("[fetchCustomerManagementData] customers count:", res.data?.length ?? 0, "for org:", orgId);
        return res.data ?? [];
      }),
    supabase
      .from("price_lists")
      .select("id, name, currency, is_default")
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .then((res) => res.data ?? []),
    supabase
      .from("products")
      .select("id, name, skus ( code )")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .then((res) => res.data ?? []),
  ]);

  return {
    customerRows: customerRows as CustomerRow[],
    priceLists: priceListRows,
    products: productRows.map((p) => ({
      id: p.id,
      name: p.name,
      sku_code: (p.skus as { code: string } | null)?.code ?? null,
    })),
  };
}

export function mapCustomers(rows: CustomerRow[]): CustomerSummary[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    email: row.email,
    phone: row.phone,
    vatNumber: row.vat_number,
    notes: row.notes,
    defaultPriceListId: row.default_price_list_id,
    defaultPriceListName: row.price_lists?.name ?? null,
    store: row.store,
    accountsEmail: row.accounts_email,
    pricingTier: row.pricing_tier,
    createdAt: row.created_at,
    // New fields
    currency: row.currency ?? 'EUR',
    countryCode: row.country_code ?? 'IE',
    paymentTermsDays: row.payment_terms_days ?? 30,
    creditLimit: row.credit_limit,
    accountCode: row.account_code,
    requiresPrePricing: row.requires_pre_pricing ?? false,
    deliveryPreferences: null,
    // Aggregated
    orderCount: 0, // TODO: aggregate from orders
    aliasCount: 0, // TODO: aggregate from product_aliases
    priceListAssignments:
      row.price_list_customers?.map((plc) => ({
        id: plc.id,
        priceListId: plc.price_list_id,
        priceListName: plc.price_lists?.name ?? "Unknown",
        validFrom: plc.valid_from,
        validTo: plc.valid_to,
      })) ?? [],
    // Addresses
    addresses: mapAddresses(row.customer_addresses),
    // Contacts
    contacts: mapContacts(row.customer_contacts),
  }));
}

function mapAddresses(
  addresses: CustomerRow["customer_addresses"]
): CustomerAddressSummary[] {
  if (!addresses) return [];
  return addresses.map((addr) => ({
    id: addr.id,
    label: addr.label,
    storeName: addr.store_name,
    line1: addr.line1,
    line2: addr.line2,
    city: addr.city,
    county: addr.county,
    eircode: addr.eircode,
    countryCode: addr.country_code ?? 'IE',
    isDefaultShipping: addr.is_default_shipping,
    isDefaultBilling: addr.is_default_billing,
    contactName: addr.contact_name,
    contactEmail: addr.contact_email,
    contactPhone: addr.contact_phone,
  }));
}

function mapContacts(
  contacts: CustomerRow["customer_contacts"]
): CustomerContactSummary[] {
  if (!contacts) return [];
  return contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    mobile: contact.mobile,
    role: contact.role,
    isPrimary: contact.is_primary,
  }));
}
