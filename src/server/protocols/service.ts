import 'server-only';
import { createClient } from "@/lib/supabase/server";
import { buildBatchRoute } from "@/server/batches/route";
import { getBatchById } from "@/server/batches/service";
import { logger } from "@/server/utils/logger";

export async function createProtocolFromBatch(batchId: string, opts?: { name?: string; publish?: boolean }) {
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error("Batch not found.");

  const name =
    opts?.name ||
    `Protocol ${batch.plantVariety ? `– ${batch.plantVariety}` : ""} (${new Date().toISOString().slice(0, 10)})`;

  const definition = {
    version: 1,
    status: opts?.publish ? "published" : "draft",
    created_from_batch_id: String(batchId),
    plant_family: batch.plantFamily ?? null,
    plant_variety: batch.plantVariety ?? (batch as any).variety ?? null,
    season: inferSeason(batch.plantingDate || batch.sowDate),
    pot_size: batch.potSize ?? null,
    media: (batch as any).media ?? null,
    container_type: (batch as any).containerType ?? null,
    supplier_name: batch.supplierName ?? null,
    supplier_id: batch.supplierId ?? null,
    targets: {
      tempC: {
        day: (batch as any).targetTempDayC ?? null,
        night: (batch as any).targetTempNightC ?? null,
      },
      humidityPct: (batch as any).targetHumidityPct ?? null,
      lightHours: (batch as any).targetLightHours ?? null,
      ec: (batch as any).targetEC ?? null,
      ph: (batch as any).targetPH ?? null,
      spacing: (batch as any).spacing ?? null,
    },
    steps: normalizeSteps((batch as any).steps || (batch as any).carePlan || []),
    source_snapshot: {
      batchNumber: batch.batchNumber ?? null,
      sowDate: batch.sowDate ?? null,
      plantingDate: batch.plantingDate ?? null,
      size: batch.size ?? null,
      location: batch.location ?? null,
    },
  };

  let routePayload: any = { nodes: [], edges: [] };
  try {
    routePayload = await buildBatchRoute(batchId, 3);
  } catch (e) {
    logger.protocols.warn("Route build failed when creating protocol from batch", { batchId, error: e instanceof Error ? e.message : String(e) });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("protocols")
    .insert({
      org_id: batch.orgId,
      name,
      description: batch.batchNumber ? `Derived from batch ${batch.batchNumber}` : null,
      target_variety_id: batch.plantVarietyId ?? null,
      target_size_id: batch.sizeId ?? null,
      definition,
      route: routePayload,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function inferSeason(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${d.getFullYear()}-Q${q}`;
  } catch {
    return null;
  }
}

// Ensure steps have the expected shape
function normalizeSteps(raw: any[]): Array<{ title: string; kind: any; notes?: string; intervalDays?: number | null }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      title: typeof s?.title === "string" ? s.title : String(s?.name || "Step"),
      kind: (s?.kind || s?.type || "misc") as any,
      notes: typeof s?.notes === "string" ? s.notes : undefined,
      intervalDays: typeof s?.intervalDays === "number" ? s.intervalDays : null,
    }))
    .slice(0, 50);
}
