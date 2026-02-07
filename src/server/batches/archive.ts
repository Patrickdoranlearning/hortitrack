import { getSupabaseAdmin } from "@/server/db/supabase";
import { logError } from "@/lib/log";

/**
 * Archives a batch with org_id security filtering, quantity zeroing, and audit trail.
 *
 * - Verifies the batch belongs to the given org before modifying.
 * - Sets quantity to 0 and status to "Archived".
 * - Creates an ARCHIVE batch_event if the batch had remaining quantity.
 */
export async function archiveBatch(
  batchId: string,
  orgId: string,
  userId?: string,
  reason?: string
) {
  const supabase = getSupabaseAdmin();
  const timestamp = new Date().toISOString();

  // 1. Read current batch with org_id filter for security
  const { data: batch, error: readError } = await supabase
    .from("batches")
    .select("id, quantity, org_id")
    .eq("id", batchId)
    .eq("org_id", orgId)
    .single();

  if (readError || !batch) {
    logError("[archiveBatch] Batch not found or org mismatch", {
      batchId,
      orgId,
      error: readError?.message,
    });
    throw new Error("Batch not found or access denied");
  }

  // 2. Update batch: set status, archived_at, and zero out quantity
  const previousQuantity = batch.quantity ?? 0;
  const { error: updateError } = await supabase
    .from("batches")
    .update({
      status: "Archived",
      archived_at: timestamp,
      updated_at: timestamp,
      quantity: 0,
    })
    .eq("id", batchId)
    .eq("org_id", orgId);

  if (updateError) {
    logError("[archiveBatch] Failed to update batch", {
      batchId,
      orgId,
      error: updateError.message,
    });
    throw new Error(updateError.message);
  }

  // 3. Create audit trail event if there was remaining quantity
  if (previousQuantity > 0) {
    const { error: eventError } = await supabase
      .from("batch_events")
      .insert({
        batch_id: batchId,
        org_id: orgId,
        type: "ARCHIVE",
        by_user_id: userId ?? null,
        at: timestamp,
        payload: JSON.stringify({
          previous_quantity: previousQuantity,
          reason: reason || "Batch archived",
          archived_by: userId || "system",
        }),
      });

    if (eventError) {
      // Log but don't fail the archive -- the batch is already archived
      logError("[archiveBatch] Failed to create batch event", {
        batchId,
        orgId,
        error: eventError.message,
      });
    }
  }

  return {
    id: batchId,
    previousQuantity,
    archivedAt: timestamp,
  };
}
