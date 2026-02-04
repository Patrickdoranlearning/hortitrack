import { notFound } from "next/navigation";
import { PageFrame } from '@/ui/templates';
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/server/auth/org";
import CustomerDetailClient from "./CustomerDetailClient";
import {
  fetchCustomerDetail,
  fetchCustomerOrders,
  fetchFavouriteProducts,
  fetchCustomerInteractions,
  computeLastOrderWeek,
  computeExtendedCustomerStats,
} from "./customer-detail-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CustomerDetailPageProps {
  params: Promise<{ customerId: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { customerId } = await params;
  const supabase = await createClient();
  const orgId = await getActiveOrgId(supabase);

  // Validate customerId format (should be UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(customerId)) {
    console.error("Invalid customer ID format:", customerId);
    notFound();
  }

  // Fetch all data in parallel
  const [customer, orders, favouriteProducts, interactionsResult, priceLists, products] = await Promise.all([
    fetchCustomerDetail(supabase, customerId),
    fetchCustomerOrders(supabase, customerId),
    fetchFavouriteProducts(supabase, customerId),
    fetchCustomerInteractions(supabase, customerId),
    fetchPriceLists(supabase, orgId),
    fetchProducts(supabase, orgId),
  ]);

  if (!customer) {
    notFound();
  }

  // Compute derived data
  const lastOrderWeek = computeLastOrderWeek(orders);
  const stats = computeExtendedCustomerStats(orders);

  return (
    <PageFrame moduleKey="sales">
      <CustomerDetailClient
        customer={customer}
        orders={orders}
        favouriteProducts={favouriteProducts}
        interactions={interactionsResult.interactions}
        lastOrderWeek={lastOrderWeek}
        stats={stats}
        priceLists={priceLists}
        products={products}
      />
    </PageFrame>
  );
}

// Helper functions for fetching data needed by CustomerSheet
async function fetchPriceLists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<Array<{ id: string; name: string; currency: string }>> {
  const { data } = await supabase
    .from("price_lists")
    .select("id, name, currency")
    .eq("org_id", orgId)
    .order("name");

  return (data ?? []).map((pl: { id: string; name: string; currency: string | null }) => ({
    id: pl.id,
    name: pl.name,
    currency: pl.currency ?? "EUR",
  }));
}

async function fetchProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<Array<{ id: string; name: string; skuCode: string | null }>> {
  const { data } = await supabase
    .from("skus")
    .select(`
      id,
      code,
      display_name,
      plant_varieties (name),
      plant_sizes (name)
    `)
    .eq("org_id", orgId)
    .order("display_name");

  return (data ?? []).map((sku: any) => {
    const varietyName = sku.plant_varieties?.name ?? null;
    const sizeName = sku.plant_sizes?.name ?? null;
    const name = sku.display_name ||
      [varietyName, sizeName].filter(Boolean).join(" - ") ||
      sku.code ||
      "Unknown";

    return {
      id: sku.id,
      name,
      skuCode: sku.code,
    };
  });
}
