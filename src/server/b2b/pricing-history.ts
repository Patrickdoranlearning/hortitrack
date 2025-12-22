import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type PricingHistoryHint = {
  rrp?: number | null;
  multibuyPrice2?: number | null;
  multibuyQty2?: number | null;
};

export async function getLastUsedPricing(
  supabase: SupabaseClient<Database>,
  customerId: string,
  productIds: string[]
): Promise<Record<string, PricingHistoryHint>> {
  if (productIds.length === 0) return {};

  const { data, error } = await supabase
    .from("order_items")
    .select(
      `
        product_id,
        rrp,
        multibuy_price_2,
        multibuy_qty_2,
        created_at,
        orders!inner(customer_id)
      `
    )
    .eq("orders.customer_id", customerId)
    .in("product_id", productIds)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("[getLastUsedPricing]", error);
    return {};
  }

  const hints: Record<string, PricingHistoryHint> = {};

  for (const row of data) {
    const productId = row.product_id;
    if (!productId) continue;
    if (!hints[productId]) {
      hints[productId] = {
        rrp: row.rrp,
        multibuyPrice2: row.multibuy_price_2,
        multibuyQty2: row.multibuy_qty_2,
      };
    }
  }

  return hints;
}

