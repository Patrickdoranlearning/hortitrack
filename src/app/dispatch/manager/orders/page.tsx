import { redirect } from "next/navigation";
import { getUserAndOrg } from "@/server/auth/org";
import { Card } from "@/components/ui/card";
import DispatchOrdersClient from "@/components/dispatch/manager/DispatchOrdersClient";
import { format } from "date-fns";
import { getHauliersWithVehicles } from "@/server/dispatch/queries.server";

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
    .select("user_id, role, profiles:profiles!org_memberships_user_id_profiles_fkey(id, display_name, full_name)")
    .eq("org_id", orgId)
    .in("role", ["grower", "admin", "owner", "sales"]);

  if (membersError) {
    console.error("Error fetching org members:", membersError.message || JSON.stringify(membersError));
  }

  const availablePickers: Array<{ id: string; name: string }> = (orgMembers || [])
    .filter((m: any) => m.profiles) // Filter out members without profiles
    .map((m: any) => ({
      id: m.user_id,
      name: m.profiles?.display_name || m.profiles?.full_name || "Unknown",
    }));

  // Create picker map for display
  const pickerMap: Record<string, string> = {};
  availablePickers.forEach(p => {
    pickerMap[p.id] = p.name;
  });

  // Fetch available delivery runs (loads) for assignment with order details
  const { data: deliveryRuns } = await supabase
    .from("delivery_runs")
    .select(`
      id,
      load_name,
      run_date,
      status,
      haulier_id,
      vehicle_id,
      haulier:hauliers(id, name),
      vehicle:haulier_vehicles(id, name, trolley_capacity),
      delivery_items(
        id,
        orders(
          id,
          status,
          trolleys_estimated,
          pick_lists:pick_lists!pick_lists_order_id_fkey(status)
        )
      )
    `)
    .eq("org_id", orgId)
    .in("status", ["planned", "loading"])
    .order("run_date", { ascending: true })
    .limit(50);

  // Fetch hauliers with vehicles for the load cards
  const hauliers = await getHauliersWithVehicles();

  // Process loads with order statistics
  const availableLoads = (deliveryRuns || []).map((r: any) => {
    const orderItems = r.delivery_items || [];
    const totalOrders = orderItems.length;
    const totalTrolleys = orderItems.reduce((sum: number, item: any) =>
      sum + (item.orders?.trolleys_estimated || 0), 0);

    // Count orders by readiness (packed = ready to load)
    const readyOrders = orderItems.filter((item: any) =>
      item.orders?.status === 'packed'
    ).length;

    // Count orders still being picked
    const pickingOrders = orderItems.filter((item: any) => {
      const pickList = item.orders?.pick_lists;
      const plStatus = Array.isArray(pickList) ? pickList[0]?.status : pickList?.status;
      return plStatus === 'in_progress' || plStatus === 'pending';
    }).length;

    return {
      id: r.id,
      name: r.load_name || (r.run_date ? format(new Date(r.run_date), "EEE MMM d") : `Load #${r.id.slice(0, 4)}`),
      date: r.run_date,
      status: r.status,
      haulierId: r.haulier_id || null,
      vehicleId: r.vehicle_id || null,
      haulierName: r.haulier?.name || null,
      vehicleName: r.vehicle?.name || null,
      vehicleCapacity: r.vehicle?.trolley_capacity || 0,
      totalOrders,
      totalTrolleys,
      readyOrders,
      pickingOrders,
    };
  });

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
        hauliers={hauliers}
      />
    </div>
  );
}
