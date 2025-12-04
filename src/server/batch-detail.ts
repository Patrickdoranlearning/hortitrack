import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

export const BatchDetailSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  variety: z.string().default(""),
  family: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  productionWeek: z.string().nullable().optional(),
  status: z
    .enum([
      "Active",
      "Archived",
      "Dispatched",
      "Growing",
      "Propagation",
      "Potted",
      "Ready for Sale",
      "Looking Good",
      "Plugs/Liners",
      "Incoming",
      "Planned",
    ])
    .default("Active"),
  ancestryNodes: z.array(z.any()).optional(), // Add ancestryNodes to the schema
});

export type BatchDetail = z.infer<typeof BatchDetailSchema>;

export async function getBatchDetail(batchId: string): Promise<BatchDetail | null> {
  const supabase = await getSupabaseForRequest();
  
  const { data, error } = await supabase
    .from("v_batch_search")
    .select("id, batch_number, variety_name, family, size_name, supplier_name, status")
    .eq("id", batchId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching batch detail from v_batch_search:", error);
    throw new Error("DB(Supabase): " + error.message);
  }

  if (!data) return null;

  return BatchDetailSchema.parse({
    id: data.id,
    batchNumber: data.batch_number,
    variety: data.variety_name ?? "",
    family: data.family ?? null,
    size: data.size_name ?? null,
    supplierName: data.supplier_name ?? null,
    status: data.status ?? "Active",
  });
}
