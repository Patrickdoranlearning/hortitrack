import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import { subDays, differenceInWeeks, format, startOfDay, parseISO } from "date-fns";

export const runtime = "nodejs";

export type ProductionDashboardData = {
  totals: {
    totalPlants: number;
    availablePlants: number;
    growingPlants: number;
    reservedPlants: number;
    lossLast30Days: number;
    lossPercentage: number;
  };
  byStatus: { status: string; behavior: string; count: number; quantity: number }[];
  byFamily: { family: string; quantity: number; available: number; growing: number }[];
  byVariety: { family: string; variety: string; varietyId: string; quantity: number }[];
  byLocation: { 
    locationId: string; 
    locationName: string; 
    site: string; 
    quantity: number; 
    batchCount: number;
    area: number | null;
  }[];
  byAge: { weekNumber: number; label: string; quantity: number }[];
  lossTimeline: { date: string; quantity: number; reason: string }[];
  batches: {
    id: string;
    batchNumber: string;
    variety: string;
    varietyId: string;
    family: string;
    status: string;
    quantity: number;
    available: number;
    reserved: number;
    locationId: string;
    location: string;
    plantedAt: string | null;
  }[];
};

// Status behavior mapping
const STATUS_BEHAVIORS: Record<string, string> = {
  "Planned": "growing",
  "Incoming": "growing",
  "Propagation": "growing",
  "Growing": "growing",
  "Plugs/Liners": "growing",
  "Potted": "growing",
  "Ready for Sale": "available",
  "Ready": "available",
  "Looking Good": "available",
  "Archived": "archived",
  "Sold": "sold",
};

export async function GET() {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    // Fetch batches with joins
    const { data: batchesRaw, error: batchError } = await supabase
      .from("batches")
      .select(`
        id,
        batch_number,
        status,
        quantity,
        reserved_quantity,
        planted_at,
        location_id,
        plant_variety_id,
        plant_varieties!inner(id, name, family),
        nursery_locations(id, name, nursery_site, area)
      `)
      .eq("org_id", orgId)
      .not("status", "in", '("Archived","Sold")');

    if (batchError) throw new Error(batchError.message);

    // Fetch loss events for last 30 days
    const { data: lossEventsRaw, error: lossError } = await supabase
      .from("batch_events")
      .select("at, payload")
      .eq("org_id", orgId)
      .in("type", ["LOSS", "DUMP", "ADJUST"])
      .gte("at", thirtyDaysAgo.toISOString());

    if (lossError) throw new Error(lossError.message);

    // Process batches
    const batches = (batchesRaw ?? []).map((b: any) => ({
      id: b.id,
      batchNumber: b.batch_number,
      variety: b.plant_varieties?.name ?? "Unknown",
      varietyId: b.plant_variety_id,
      family: b.plant_varieties?.family ?? "Unknown",
      status: b.status,
      quantity: b.quantity ?? 0,
      available: Math.max(0, (b.quantity ?? 0) - (b.reserved_quantity ?? 0)),
      reserved: b.reserved_quantity ?? 0,
      locationId: b.location_id ?? "",
      location: b.nursery_locations?.name ?? "Unknown",
      site: b.nursery_locations?.nursery_site ?? "Main",
      area: b.nursery_locations?.area ?? null,
      plantedAt: b.planted_at,
    }));

    // Calculate totals
    let totalPlants = 0;
    let availablePlants = 0;
    let growingPlants = 0;
    let reservedPlants = 0;

    const statusAgg: Record<string, { count: number; quantity: number }> = {};
    const familyAgg: Record<string, { quantity: number; available: number; growing: number }> = {};
    const varietyAgg: Record<string, { family: string; variety: string; varietyId: string; quantity: number }> = {};
    const locationAgg: Record<string, { 
      locationId: string; 
      locationName: string; 
      site: string; 
      quantity: number; 
      batchCount: number;
      area: number | null;
    }> = {};
    const ageAgg: Record<number, number> = {};

    for (const batch of batches) {
      const behavior = STATUS_BEHAVIORS[batch.status] ?? "growing";
      const qty = batch.quantity;

      totalPlants += qty;
      reservedPlants += batch.reserved;

      if (behavior === "available") {
        availablePlants += batch.available;
      } else if (behavior === "growing") {
        growingPlants += qty;
      }

      // By status
      if (!statusAgg[batch.status]) {
        statusAgg[batch.status] = { count: 0, quantity: 0 };
      }
      statusAgg[batch.status].count += 1;
      statusAgg[batch.status].quantity += qty;

      // By family
      if (!familyAgg[batch.family]) {
        familyAgg[batch.family] = { quantity: 0, available: 0, growing: 0 };
      }
      familyAgg[batch.family].quantity += qty;
      if (behavior === "available") {
        familyAgg[batch.family].available += batch.available;
      } else {
        familyAgg[batch.family].growing += qty;
      }

      // By variety
      const varKey = batch.varietyId;
      if (!varietyAgg[varKey]) {
        varietyAgg[varKey] = { 
          family: batch.family, 
          variety: batch.variety, 
          varietyId: batch.varietyId,
          quantity: 0 
        };
      }
      varietyAgg[varKey].quantity += qty;

      // By location
      if (!locationAgg[batch.locationId]) {
        locationAgg[batch.locationId] = {
          locationId: batch.locationId,
          locationName: batch.location,
          site: batch.site,
          quantity: 0,
          batchCount: 0,
          area: batch.area,
        };
      }
      locationAgg[batch.locationId].quantity += qty;
      locationAgg[batch.locationId].batchCount += 1;

      // By age (weeks since planting)
      if (batch.plantedAt) {
        try {
          const plantedDate = parseISO(batch.plantedAt);
          const weeksOld = Math.max(0, differenceInWeeks(now, plantedDate));
          const cappedWeeks = Math.min(weeksOld, 52); // Cap at 52 weeks
          ageAgg[cappedWeeks] = (ageAgg[cappedWeeks] ?? 0) + qty;
        } catch {
          // Skip invalid dates
        }
      }
    }

    // Process loss events
    const lossByDate: Record<string, Record<string, number>> = {};
    let totalLoss30Days = 0;

    for (const event of lossEventsRaw ?? []) {
      const payload = event.payload as Record<string, unknown>;
      let qty = 0;
      
      if (typeof payload?.qty === "number") {
        qty = Math.abs(payload.qty);
      } else if (typeof payload?.quantity === "number") {
        qty = Math.abs(payload.quantity);
      } else if (typeof payload?.units === "number") {
        qty = Math.abs(payload.units);
      }

      // Only count negative adjustments as losses
      if (payload?.qty !== undefined && (payload.qty as number) >= 0) {
        continue;
      }

      if (qty > 0) {
        totalLoss30Days += qty;
        const dateKey = format(startOfDay(new Date(event.at)), "yyyy-MM-dd");
        const reason = (payload?.reason as string) ?? "Unknown";
        
        if (!lossByDate[dateKey]) {
          lossByDate[dateKey] = {};
        }
        lossByDate[dateKey][reason] = (lossByDate[dateKey][reason] ?? 0) + qty;
      }
    }

    // Convert loss data to timeline
    const lossTimeline: { date: string; quantity: number; reason: string }[] = [];
    for (const [date, reasons] of Object.entries(lossByDate)) {
      for (const [reason, quantity] of Object.entries(reasons)) {
        lossTimeline.push({ date, quantity, reason });
      }
    }
    lossTimeline.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate loss percentage
    const totalWithLoss = totalPlants + totalLoss30Days;
    const lossPercentage = totalWithLoss > 0 
      ? Math.round((totalLoss30Days / totalWithLoss) * 1000) / 10 
      : 0;

    // Convert aggregations to arrays
    const byStatus = Object.entries(statusAgg).map(([status, data]) => ({
      status,
      behavior: STATUS_BEHAVIORS[status] ?? "growing",
      count: data.count,
      quantity: data.quantity,
    })).sort((a, b) => {
      // Sort by pipeline order
      const order = ["Propagation", "Plugs/Liners", "Potted", "Growing", "Ready for Sale", "Ready", "Looking Good"];
      return order.indexOf(a.status) - order.indexOf(b.status);
    });

    const byFamily = Object.entries(familyAgg)
      .map(([family, data]) => ({ family, ...data }))
      .sort((a, b) => b.quantity - a.quantity);

    const byVariety = Object.values(varietyAgg)
      .sort((a, b) => b.quantity - a.quantity);

    const byLocation = Object.values(locationAgg)
      .sort((a, b) => b.quantity - a.quantity);

    // Fill in age histogram (0-12 weeks, then 12+ bucket)
    const byAge: { weekNumber: number; label: string; quantity: number }[] = [];
    for (let w = 0; w <= 12; w++) {
      byAge.push({
        weekNumber: w,
        label: w === 12 ? "12+" : `${w}`,
        quantity: w === 12 
          ? Object.entries(ageAgg)
              .filter(([k]) => parseInt(k) >= 12)
              .reduce((sum, [, v]) => sum + v, 0)
          : ageAgg[w] ?? 0,
      });
    }

    const response: ProductionDashboardData = {
      totals: {
        totalPlants,
        availablePlants,
        growingPlants,
        reservedPlants,
        lossLast30Days: totalLoss30Days,
        lossPercentage,
      },
      byStatus,
      byFamily,
      byVariety,
      byLocation,
      byAge,
      lossTimeline,
      batches: batches.map(b => ({
        id: b.id,
        batchNumber: b.batchNumber,
        variety: b.variety,
        varietyId: b.varietyId,
        family: b.family,
        status: b.status,
        quantity: b.quantity,
        available: b.available,
        reserved: b.reserved,
        locationId: b.locationId,
        location: b.location,
        plantedAt: b.plantedAt,
      })),
    };

    return NextResponse.json(response);
  } catch (err) {
    logger.production.error("Dashboard data fetch failed", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

