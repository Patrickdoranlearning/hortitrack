import { getSupabaseForRequest } from "@/server/db/supabaseServer";

export async function createBatchLog(params: {
  orgId: string; batchId: string; type: string; note?: string; qty_change?: number | null;
}) {
  const supabase = getSupabaseForRequest();
  const { error } = await supabase
    .from("batch_logs")
    .insert({
      org_id: params.orgId,
      batch_id: params.batchId,
      type: params.type,
      note: params.note ?? null,
      qty_change: params.qty_change ?? null,
    });
  if (error) throw error;
}
