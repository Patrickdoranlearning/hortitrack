import { createClient } from "@/lib/supabase/server";

export async function getBatchesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("batches")
    .select("id, batch_number")
    .in("id", ids);

  if (error) {
    console.error("Error fetching batches:", error);
    return [];
  }

  return data.map(d => ({ id: d.id, batchNumber: d.batch_number }));
}
