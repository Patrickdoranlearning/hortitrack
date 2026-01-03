import { redirect } from "next/navigation";
import { getUserAndOrg } from "@/server/auth/org";
import { Card } from "@/components/ui/card";
import DispatchOrdersClient from "@/components/dispatch/manager/DispatchOrdersClient";

// Disable caching to ensure fresh data on every request
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Dispatch Orders Page - Shows all active orders for dispatch management
 * Features: filtering, sorting, resizable columns, inline assignment
 */
export default async function DispatchOrdersPage() {
  let orgId: string;
  let supabase;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
    supabase = result.supabase;
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Unauthenticated") {
      redirect("/login?next=/dispatch/manager/orders");
    }
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Error loading orders.</p>
        </Card>
      </div>
    );
  }

  // Fetch orders with related data - exclude completed/cancelled orders
  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      requested_delivery_date,
      trolleys_estimated,
      notes,
      created_at,
      customer:customers(id, name),
      ship_to_address:customer_addresses!orders_ship_to_address_id_fkey(
        id,
        county,
        eircode,
        city
      ),
      delivery_items(
        id,
        delivery_run_id
      ),
      pick_lists:pick_lists!pick_lists_order_id_fkey(
        id,
        status,
        assigned_user_id
      )
    `)
    .eq("org_id", orgId)
    .not("status", "in", '("draft","dispatched","delivered","cancelled")')
    .order("requested_delivery_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Error fetching orders:", error.message || JSON.stringify(error));
  }

  // Debug: Log orders with their pick_lists to verify data is being fetched
  // Note: pick_lists can be a single object (UNIQUE constraint) or array
  const getPickListFromOrder = (pl: any) => {
    if (!pl) return null;
    if (Array.isArray(pl)) return pl[0] || null;
    return pl;
  };
  console.log('[Dispatch Orders] Orders count:', orders?.length);
  console.log('[Dispatch Orders] Sample orders with pick_lists:', orders?.slice(0, 5).map((o: any) => {
    const pickList = getPickListFromOrder(o.pick_lists);
    return {
      order_number: o.order_number,
      pick_lists: o.pick_lists,
      has_assigned_user: !!pickList?.assigned_user_id,
      assigned_user_id: pickList?.assigned_user_id,
    };
  }));

  // Fetch all available pickers (org members who can be pickers)
  // Valid org_role enum values: owner, admin, grower, sales, viewer
  const { data: orgMembers, error: membersError } = await supabase
    .from("org_memberships")
    .select("user_id, role, profiles:profiles!org_memberships_user_id_profiles_fkey(id, display_name, full_name, email)")
    .eq("org_id", orgId)
    .in("role", ["grower", "admin", "owner", "sales"]);

  if (membersError) {
    console.error("Error fetching org members:", membersError.message || JSON.stringify(membersError));
  }

  const availablePickers: Array<{ id: string; name: string }> = (orgMembers || [])
    .filter((m: any) => m.profiles) // Filter out members without profiles
    .map((m: any) => ({
      id: m.user_id,
      name: m.profiles?.display_name || m.profiles?.full_name || m.profiles?.email || "Unknown",
    }));

  // Create picker map for display
  const pickerMap: Record<string, string> = {};
  availablePickers.forEach(p => {
    pickerMap[p.id] = p.name;
  });

  // Fetch available delivery runs (loads) for assignment
  const { data: deliveryRuns } = await supabase
    .from("delivery_runs")
    .select("id, load_name, run_date, status")
    .eq("org_id", orgId)
    .in("status", ["planned", "loading"])
    .order("run_date", { ascending: true })
    .limit(50);

  const availableLoads: Array<{ id: string; name: string; date: string | null }> = (deliveryRuns || []).map((r: any) => ({
    id: r.id,
    name: r.load_name || `Load ${r.id.slice(0, 8)}`,
    date: r.run_date,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold">Orders</h2>
        <p className="text-muted-foreground text-sm">
          View and manage orders for dispatch
        </p>
      </div>

      {/* Orders Table Client Component */}
      <DispatchOrdersClient
        initialOrders={orders || []}
        pickerMap={pickerMap}
        availablePickers={availablePickers}
        availableLoads={availableLoads}
      />
    </div>
  );
}
