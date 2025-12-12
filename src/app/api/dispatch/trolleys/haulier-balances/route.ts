import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAndOrg } from "@/server/auth/org";

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await createClient();

    // Get active delivery runs with their trolley/shelf counts
    // This shows what's currently loaded on trucks
    const { data: activeRuns, error } = await supabase
      .from("delivery_runs")
      .select(`
        id,
        run_number,
        status,
        haulier_id,
        driver_name,
        vehicle_id,
        vehicle_registration,
        hauliers (
          id,
          name
        ),
        haulier_vehicles:vehicle_id (
          id,
          name,
          registration
        ),
        delivery_items (
          id,
          trolleys_delivered,
          trolleys_returned
        )
      `)
      .eq("org_id", orgId)
      .in("status", ["loading", "in_transit"]);

    if (error) {
      console.error("Error fetching haulier balances:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate by haulier
    const haulierMap = new Map<string, any>();

    for (const run of activeRuns || []) {
      const haulierId = run.haulier_id || "unassigned";
      const haulierName = (run.hauliers as any)?.name || "Unassigned";

      // Calculate totals for this run
      const items = run.delivery_items || [];
      const trolleysLoaded = items.reduce(
        (sum: number, item: any) => sum + (item.trolleys_delivered || 0),
        0
      );

      if (!haulierMap.has(haulierId)) {
        haulierMap.set(haulierId, {
          haulierId,
          haulierName,
          driverName: run.driver_name,
          vehicleReg: (run.haulier_vehicles as any)?.registration || run.vehicle_registration,
          trolleysLoaded: 0,
          shelvesLoaded: 0, // Not tracked per-item, but kept for UI compatibility
          currentRunId: run.id,
          currentRunNumber: run.run_number,
        });
      }

      const existing = haulierMap.get(haulierId);
      existing.trolleysLoaded += trolleysLoaded;
    }

    const balances = Array.from(haulierMap.values()).filter(
      (h) => h.trolleysLoaded > 0 || h.shelvesLoaded > 0
    );

    return NextResponse.json({ balances });
  } catch (error) {
    console.error("Error in haulier balances route:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
