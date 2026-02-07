import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export async function getBatchesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("batches")
    .select("id, batch_number")
    .in("id", ids);

  if (error) {
    logError("Error fetching batches", { error: error.message });
    return [];
  }

  return data.map(d => ({ id: d.id, batchNumber: d.batch_number }));
}
