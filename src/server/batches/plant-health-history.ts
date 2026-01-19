'use server';

import { getSupabaseAdmin } from "@/server/db/supabase";
import { isValidDocId } from "@/server/utils/ids";
import type { PlantHealthEvent } from "@/lib/history-types";

type AnyDate = Date | string | number | null | undefined;

const toDate = (value: AnyDate) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
};

/**
 * Build plant health history for a specific batch
 */
export async function buildPlantHealthHistory(batchId: string): Promise<PlantHealthEvent[]> {
  if (!isValidDocId(batchId)) {
    throw new Error("Invalid batch ID provided.");
  }

  const supabase = getSupabaseAdmin();

  const { data: logs, error } = await supabase
    .from("plant_health_logs")
    .select(`
      id,
      event_type,
      event_at,
      recorded_by,
      title,
      notes,
      product_name,
      rate,
      unit,
      method,
      reason_for_use,
      weather_conditions,
      area_treated,
      sprayer_used,
      signed_by,
      safe_harvest_date,
      harvest_interval_days,
      ph_reading,
      ec_reading,
      photos
    `)
    .eq("batch_id", batchId)
    .order("event_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (logs || []).map((log): PlantHealthEvent => {
    // Build details string for treatments
    const detailParts: string[] = [];
    if (log.product_name) {
      let productInfo = log.product_name;
      if (log.rate && log.unit) {
        productInfo += ` @ ${log.rate} ${log.unit}`;
      }
      if (log.method) {
        productInfo += ` (${log.method})`;
      }
      detailParts.push(productInfo);
    }
    if (log.reason_for_use) detailParts.push(`Reason: ${log.reason_for_use}`);
    if (log.weather_conditions) detailParts.push(`Weather: ${log.weather_conditions}`);
    if (log.area_treated) detailParts.push(`Area: ${log.area_treated}`);
    if (log.sprayer_used) detailParts.push(`Sprayer: ${log.sprayer_used}`);
    if (log.safe_harvest_date) {
      detailParts.push(`Safe harvest: ${new Date(log.safe_harvest_date).toLocaleDateString()}`);
    }
    if (log.notes && !detailParts.includes(log.notes)) detailParts.push(log.notes);

    return {
      id: log.id,
      batchId,
      at: toDate(log.event_at)?.toISOString() ?? new Date().toISOString(),
      type: (log.event_type ?? 'health') as PlantHealthEvent['type'],
      title: log.title ?? log.product_name ?? log.event_type ?? 'Health Log',
      details: detailParts.length > 0 ? detailParts.join(' | ') : null,
      productName: log.product_name,
      rate: log.rate,
      unit: log.unit,
      method: log.method,
      reasonForUse: log.reason_for_use,
      weatherConditions: log.weather_conditions,
      areaTreated: log.area_treated,
      sprayerUsed: log.sprayer_used,
      safeHarvestDate: log.safe_harvest_date,
      harvestIntervalDays: log.harvest_interval_days,
      ecReading: log.ec_reading,
      phReading: log.ph_reading,
      photos: log.photos ?? [],
      userId: log.recorded_by,
      signedBy: log.signed_by
    };
  });
}

/**
 * Get organization-wide plant health history with optional filters
 */
export async function getOrgPlantHealthHistory(params: {
  orgId: string;
  batchId?: string;
  eventType?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<{ logs: PlantHealthEvent[]; total: number }> {
  const {
    orgId,
    batchId,
    eventType,
    fromDate,
    toDate: toDateParam,
    limit = 50,
    offset = 0,
    search
  } = params;

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("plant_health_logs")
    .select(`
      id,
      batch_id,
      event_type,
      event_at,
      recorded_by,
      title,
      notes,
      product_name,
      rate,
      unit,
      method,
      reason_for_use,
      weather_conditions,
      area_treated,
      sprayer_used,
      signed_by,
      safe_harvest_date,
      harvest_interval_days,
      ph_reading,
      ec_reading,
      photos,
      batches(
        batch_number,
        plant_varieties(name)
      )
    `, { count: 'exact' })
    .eq("org_id", orgId)
    .order("event_at", { ascending: false });

  // Apply filters
  if (batchId) {
    query = query.eq("batch_id", batchId);
  }

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  if (fromDate) {
    query = query.gte("event_at", fromDate);
  }

  if (toDateParam) {
    query = query.lte("event_at", toDateParam);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,product_name.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data: logs, error, count } = await query;

  if (error) throw new Error(error.message);

  const healthEvents: PlantHealthEvent[] = (logs || []).map((log: any): PlantHealthEvent => {
    const detailParts: string[] = [];
    if (log.product_name) {
      let productInfo = log.product_name;
      if (log.rate && log.unit) {
        productInfo += ` @ ${log.rate} ${log.unit}`;
      }
      if (log.method) {
        productInfo += ` (${log.method})`;
      }
      detailParts.push(productInfo);
    }
    if (log.reason_for_use) detailParts.push(`Reason: ${log.reason_for_use}`);
    if (log.weather_conditions) detailParts.push(`Weather: ${log.weather_conditions}`);
    if (log.notes && !detailParts.includes(log.notes)) detailParts.push(log.notes);

    const batchData = Array.isArray(log.batches) ? log.batches[0] : log.batches;
    const varietyData = batchData?.plant_varieties;
    const variety = Array.isArray(varietyData) ? varietyData[0] : varietyData;

    return {
      id: log.id,
      batchId: log.batch_id,
      batchNumber: batchData?.batch_number,
      varietyName: variety?.name,
      at: toDate(log.event_at)?.toISOString() ?? new Date().toISOString(),
      type: (log.event_type ?? 'health') as PlantHealthEvent['type'],
      title: log.title ?? log.product_name ?? log.event_type ?? 'Health Log',
      details: detailParts.length > 0 ? detailParts.join(' | ') : null,
      productName: log.product_name,
      rate: log.rate,
      unit: log.unit,
      method: log.method,
      reasonForUse: log.reason_for_use,
      weatherConditions: log.weather_conditions,
      areaTreated: log.area_treated,
      sprayerUsed: log.sprayer_used,
      safeHarvestDate: log.safe_harvest_date,
      harvestIntervalDays: log.harvest_interval_days,
      ecReading: log.ec_reading,
      phReading: log.ph_reading,
      photos: log.photos ?? [],
      userId: log.recorded_by,
      signedBy: log.signed_by
    };
  });

  return {
    logs: healthEvents,
    total: count ?? 0
  };
}

/**
 * Get summary stats for plant health activity
 */
export async function getPlantHealthSummary(batchId: string) {
  const logs = await buildPlantHealthHistory(batchId);

  const summary = {
    totalLogs: logs.length,
    treatments: 0,
    scoutFlags: 0,
    measurements: 0,
    clearances: 0,
    lastActivity: null as string | null
  };

  for (const log of logs) {
    switch (log.type) {
      case 'treatment':
        summary.treatments++;
        break;
      case 'scout_flag':
        summary.scoutFlags++;
        break;
      case 'measurement':
        summary.measurements++;
        break;
      case 'clearance':
        summary.clearances++;
        break;
    }
  }

  if (logs.length > 0) {
    summary.lastActivity = logs[0].at;
  }

  return summary;
}
