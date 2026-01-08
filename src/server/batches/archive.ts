import { getSupabaseAdmin } from "@/server/db/supabase";

export async function archiveBatch(batchId: string) {
  const supabase = getSupabaseAdmin();
  const timestamp = new Date().toISOString();
  const { error } = await supabase
    .from("batches")
    .update({
      status: "Archived",
      archived_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", batchId);

  if (error) {
    throw new Error(error.message);
  }
}
