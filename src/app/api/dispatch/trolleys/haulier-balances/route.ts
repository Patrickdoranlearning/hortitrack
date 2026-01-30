import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAndOrg } from "@/server/auth/org";
import { logger, getErrorMessage } from "@/server/utils/logger";

// Type for delivery item in the query result
interface DeliveryItemData {
  id: string;
  trolleys_delivered: number | null;
  trolleys_returned: number | null;
}

// Type for the query result
interface DeliveryRunQueryRow {
  id: string;
  run_number: string;
  status: string;
  haulier_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  vehicle_registration: string | null;
  hauliers: { id: string; name: string } | { id: string; name: string }[] | null;
  haulier_vehicles: { id: string; name: string; registration: string } | { id: string; name: string; registration: string }[] | null;
  delivery_items: DeliveryItemData[];
}

// Type for haulier balance aggregation
interface HaulierBalance {
  haulierId: string;
  haulierName: string;
  driverName: string | null;
  vehicleReg: string | null;
  trolleysLoaded: number;
  shelvesLoaded: number;
  currentRunId: string;
  currentRunNumber: string;
}

function asSingle<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

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
      logger.trolley.error("Error fetching haulier balances", error, { orgId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate by haulier
    const haulierMap = new Map<string, HaulierBalance>();

    for (const row of (activeRuns || []) as unknown as DeliveryRunQueryRow[]) {
      const haulierId = row.haulier_id || "unassigned";
      const haulier = asSingle(row.hauliers);
      const haulierName = haulier?.name || "Unassigned";

      // Calculate totals for this run
      const items = row.delivery_items || [];
      const trolleysLoaded = items.reduce(
        (sum: number, item: DeliveryItemData) => sum + (item.trolleys_delivered || 0),
        0
      );

      const vehicle = asSingle(row.haulier_vehicles);

      if (!haulierMap.has(haulierId)) {
        haulierMap.set(haulierId, {
          haulierId,
          haulierName,
          driverName: row.driver_name,
          vehicleReg: vehicle?.registration || row.vehicle_registration,
          trolleysLoaded: 0,
          shelvesLoaded: 0, // Not tracked per-item, but kept for UI compatibility
          currentRunId: row.id,
          currentRunNumber: row.run_number,
        });
      }

      const existing = haulierMap.get(haulierId);
      if (existing) {
        existing.trolleysLoaded += trolleysLoaded;
      }
    }

    const balances = Array.from(haulierMap.values()).filter(
      (h) => h.trolleysLoaded > 0 || h.shelvesLoaded > 0
    );

    return NextResponse.json({ balances });
  } catch (error) {
    logger.trolley.error("Error in haulier balances route", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
