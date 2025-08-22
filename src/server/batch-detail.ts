import { z } from "zod";

export const BatchDetailSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  variety: z.string().default(""),
  family: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  productionWeek: z.string().nullable().optional(),
  status: z.enum(["Active", "Archived", "Dispatched"]).default("Active"),
  ancestryNodes: z.array(z.any()).optional(), // Add ancestryNodes to the schema
});

export type BatchDetail = z.infer<typeof BatchDetailSchema>;

let _supabase: any | null | undefined;
let _firestore: any | null | undefined;

function getSupabaseClient() {
  if (_supabase !== undefined) return _supabase;
  try {
    const mod = require("@/lib/supabase/server");
    _supabase = mod.supabaseServerClient?.() ?? mod.createClient?.() ?? null;
  } catch { _supabase = null; }
  return _supabase;
}

function getFirestore() {
  if (_firestore !== undefined) return _firestore;
  try {
    const mod = require("@/lib/firebase");
    _firestore = mod.firestore ?? mod.db ?? null;
  } catch { _firestore = null; }
  return _firestore;
}

export async function getBatchDetail(batchId: string): Promise<BatchDetail | null> {
  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb
      .from("Batch")
      .select("id,batch_number,variety,family,size,supplier_id,production_week,status")
      .eq("id", batchId)
      .maybeSingle();
    if (error) throw new Error("DB(Supabase): " + error.message);
    if (!data) return null;

    let supplierName: string | null = null;
    if (data.supplier_id) {
      const { data: s, error: se } = await sb
        .from("Supplier").select("id,name").eq("id", data.supplier_id).maybeSingle();
      if (se) throw new Error("DB(Supabase): " + se.message);
      supplierName = s?.name ?? null;
    }

    return BatchDetailSchema.parse({
      id: data.id,
      batchNumber: data.batch_number,
      variety: data.variety ?? "",
      family: data.family ?? null,
      size: data.size ?? null,
      supplierName,
      productionWeek: data.production_week ?? null,
      status: data.status ?? "Active",
    });
  }

  const fs = getFirestore();
  if (fs) {
    const ref = fs.collection("batches").doc(batchId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const b = snap.data() as any;

    let supplierName: string | null = null;
    const supplierId = b.supplier_id ?? b.supplierId ?? null;
    if (supplierId) {
      const sref = fs.collection("suppliers").doc(supplierId);
      const ssnap = await sref.get();
      if (ssnap.exists) supplierName = (ssnap.data() as any)?.name ?? null;
    }

    return BatchDetailSchema.parse({
      id: snap.id,
      batchNumber: b.batch_number ?? b.batchNumber ?? snap.id,
      variety: b.variety ?? "",
      family: b.family ?? null,
      size: b.size ?? null,
      supplierName: supplierName ?? (supplierId ? null : "In-house"),
      productionWeek: b.production_week ?? b.productionWeek ?? null,
      status: (b.status ?? "Active") as any,
    });
  }

  throw new Error("No database client configured.");
}
