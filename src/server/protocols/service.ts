
import { adminDb } from "@/server/db/admin";

export async function getBatchById(id: string) {
  const snap = await adminDb.collection("batches").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as any;
}

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
    createdAt: new Date(),
    createdFromBatchId: String(batchId),

    plantFamily: batch.plantFamily ?? null,
    plantVariety: batch.plantVariety ?? batch.variety ?? null,
    season: inferSeason(batch.plantingDate || batch.sowDate),

    potSize: batch.size ?? batch.potSize ?? null,
    media: batch.media ?? batch.substrate ?? null,
    containerType: batch.containerType ?? null,
    supplierName: batch.supplier?.name ?? batch.supplierName ?? batch.vendorName ?? null,
    supplierId: batch.supplier?.id ?? batch.supplierId ?? d.vendorId ?? null,

    targets: {
      tempC: {
        day: batch.targetTempDayC ?? null,
        night: batch.targetTempNightC ?? null,
      },
      humidityPct: batch.targetHumidityPct ?? null,
      lightHours: batch.targetLightHours ?? null,
      ec: batch.targetEC ?? null,
      ph: batch.targetPH ?? null,
      spacing: batch.spacing ?? null,
    },

    // Placeholder steps; extend later by mining your action log
    steps: normalizeSteps(batch.steps || batch.carePlan || []),

    sourceSnapshot: {
      batchNumber: batch.batchNumber ?? null,
      sowDate: batch.sowDate ?? null,
      plantingDate: batch.plantingDate ?? null,
      size: batch.size ?? null,
      location: batch.location ?? null,
    },
  };

  const ref = await adminDb.collection("protocols").add(protocol);
  return { id: ref.id, ...protocol };
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
