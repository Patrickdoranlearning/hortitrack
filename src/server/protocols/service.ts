import 'server-only';
import { createClient } from "@/lib/supabase/server";
import { isValidDocId } from "@/server/utils/ids";
import { buildBatchRoute } from "@/server/batches/route";
import { getBatchById } from "@/server/batches/service";

// Removed local getBatchById

export async function createProtocolFromBatch(batchId: string, opts?: { name?: string; publish?: boolean }) {
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error("Batch not found.");

  const name =
    opts?.name ||
    `Protocol ${batch.plantVariety ? `– ${batch.plantVariety}` : ""} (${new Date().toISOString().slice(0, 10)})`;

  // Heuristics: pull likely fields if present
  const protocol = {
    name,
    version: 1,
    status: opts?.publish ? "published" : "draft",
    created_at: new Date().toISOString(),
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

    // Placeholder steps; extend later by mining your action log
    steps: normalizeSteps((batch as any).steps || (batch as any).carePlan || []),

    source_snapshot: {
      batchNumber: batch.batchNumber ?? null,
      sowDate: batch.sowDate ?? null,
      plantingDate: batch.plantingDate ?? null,
      size: batch.size ?? null,
      location: batch.location ?? null,
    },
    // lineage & timeline will be attached below
  };

  // Route is useful but not critical — don't fail PDF if it errors
  try {
    const route = await buildBatchRoute(batchId, 3);
    (protocol as any).route = route;
  } catch (e) {
    console.warn("[createProtocolFromBatch] route build failed", e);
    (protocol as any).route = { ancestry: [], edges: [], nodes: {}, timeline: [], summary: { hops: 0 } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("protocols").insert(protocol).select().single();

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
