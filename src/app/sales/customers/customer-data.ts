import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { CustomerSummary, CustomerManagementPayload } from "./types";

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
  price_lists: { id: string; name: string } | null;
  price_list_customers: Array<{
    id: string;
    price_list_id: string;
    valid_from: string | null;
    valid_to: string | null;
    price_lists: { id: string; name: string } | null;
  }> | null;
};

export async function fetchCustomerManagementData(
  supabase: SupabaseServerClient,
  orgId: string
): Promise<{ customerRows: CustomerRow[]; priceLists: Array<{ id: string; name: string; currency: string; is_default: boolean | null }> }> {
  const [customerRows, priceListRows] = await Promise.all([
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
        price_lists ( id, name ),
        price_list_customers (
          id,
          price_list_id,
          valid_from,
          valid_to,
          price_lists ( id, name )
        )
      `
      )
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .then((res) => res.data ?? []),
    supabase
      .from("price_lists")
      .select("id, name, currency, is_default")
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .then((res) => res.data ?? []),
  ]);

  return {
    customerRows: customerRows as CustomerRow[],
    priceLists: priceListRows,
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
  }));
}

