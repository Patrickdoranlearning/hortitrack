import "server-only";
import { dualWriteEnabled, getSupabaseAdmin } from "@/server/db/supabase";
import type { z } from "zod";
import type { ActionInputSchema } from "@/lib/actions/schema";

type ActionInput = z.infer<typeof ActionInputSchema>;

export async function dualWriteActionLog(action: ActionInput) {
  if (!dualWriteEnabled()) return;
  const sb = getSupabaseAdmin();
  const row = {
    action_id: action.actionId,
    type: action.type,
    batch_numbers: action.batchNumbers ?? [],
    payload: action as any,
  };
  const { error } = await sb.from("actions_log").insert(row);
  if (error && !/duplicate key|already exists/i.test(error.message)) {
    // Do not fail the request path
    console.warn("[dualwrite] actions_log insert failed", { error: error.message, actionId: action.actionId });
  }
}

export async function dualWriteBatchCreate(batch: {
  id: string; batchNumber: string; category: string; plantFamily: string; plantVariety: string;
  plantingDate: string; initialQuantity: number; quantity: number; status: string;
  location?: string|null; locationId?: string|null; size?: string|null; supplierId?: string|null; notes?: string|null;
}) {
  if (!dualWriteEnabled()) return;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("batches").insert({
    id: batch.id,
    batch_number: batch.batchNumber,
    category: batch.category,
    plant_family: batch.plantFamily,
    plant_variety: batch.plantVariety,
    planting_date: batch.plantingDate,
    initial_quantity: batch.initialQuantity,
    quantity: batch.quantity,
    status: batch.status,
    location: batch.location ?? null,
    location_id: batch.locationId ?? null,
    size: batch.size ?? null,
    supplier_id: batch.supplierId ?? null,
    notes: batch.notes ?? null,
  });
  if (error && !/duplicate key|already exists/i.test(error.message)) {
    console.warn("[dualwrite] batches insert failed", { error: error.message, id: batch.id });
  }
}
