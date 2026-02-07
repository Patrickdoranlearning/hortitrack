"use server";

import { TransplantInputSchema, type TransplantInput } from "@/lib/domain/batch";
import { getUserAndOrg } from "@/server/auth/org";
import { revalidatePath } from "next/cache";
import { consumeMaterialsForBatch, savePlannedMaterialsFromRules } from "@/server/materials/consumption";

export type TransplantResult = {
  success: true;
  data: {
    requestId: string;
    childBatch: {
      id: string;
      batchNumber: string;
      quantity: number;
      phase: string;
    };
    parentNewQuantity: number;
  };
} | {
  success: false;
  error: string;
};

/**
 * Transplant a batch - creates a new child batch from a parent batch
 * 
 * This uses a PostgreSQL RPC function to ensure transactional integrity.
 * All operations (create child, decrement parent, link ancestry, log events,
 * create passport) happen atomically - either all succeed or all fail.
 */
export async function transplantBatchAction(input: TransplantInput): Promise<TransplantResult> {
  try {
    console.log("[transplantBatchAction] Input:", JSON.stringify(input, null, 2));

    // Validate input
    const validated = TransplantInputSchema.parse(input);

    // Get authenticated user and org
    const { supabase, orgId, user } = await getUserAndOrg();

    const rpcParams: Record<string, unknown> = {
      p_org_id: orgId,
      p_parent_batch_id: validated.parent_batch_id,
      p_size_id: validated.size_id,
      p_location_id: validated.location_id,
      p_containers: validated.containers ?? 1,
      p_user_id: user.id,
      p_planted_at: validated.planted_at ?? null,
      p_notes: validated.notes ?? null,
      p_archive_parent_if_empty: validated.archive_parent_if_empty ?? true,
      p_units: validated.units ?? null, // Pass units directly if provided
    };

    console.log("[transplantBatchAction] RPC params:", JSON.stringify(rpcParams, null, 2));

    // Call the transactional RPC function
    const { data, error } = await supabase.rpc("perform_transplant", rpcParams);

    if (error) {
      console.error("[transplantBatchAction] RPC error:", error.message, error.details, error.hint);
      
      // Parse specific error messages for better UX
      if (error.message.includes("Insufficient quantity")) {
        return { success: false, error: "Not enough plants in the source batch" };
      }
      if (error.message.includes("not found")) {
        return { success: false, error: "Batch not found or you don't have access" };
      }
      
      return { success: false, error: error.message };
    }

    // Revalidate the batches page to show new data
    revalidatePath("/production/batches");
    revalidatePath("/production");

    // Transform the snake_case response to camelCase
    const result = data as {
      request_id: string;
      child_batch: {
        id: string;
        batch_number: string;
        quantity: number;
        phase: string;
      };
      parent_new_quantity: number;
    };

    // Save planned materials so workers see them in the materials checklist
    try {
      await savePlannedMaterialsFromRules(
        supabase,
        orgId,
        result.child_batch.id,
        validated.size_id,
        result.child_batch.quantity
      );
    } catch (planErr) {
      console.error("[transplantBatchAction] Planned materials save failed:", planErr);
    }

    // Consume materials for the new child batch
    try {
      await consumeMaterialsForBatch(
        supabase,
        orgId,
        user.id,
        result.child_batch.id,
        result.child_batch.batch_number,
        validated.size_id,
        result.child_batch.quantity,
        validated.location_id,
        true // allowPartial
      );
    } catch (consumeErr) {
      console.error("[transplantBatchAction] Material consumption failed:", consumeErr);
    }

    return {
      success: true,
      data: {
        requestId: result.request_id,
        childBatch: {
          id: result.child_batch.id,
          batchNumber: result.child_batch.batch_number,
          quantity: result.child_batch.quantity,
          phase: result.child_batch.phase,
        },
        parentNewQuantity: result.parent_new_quantity,
      },
    };
  } catch (e: unknown) {
    console.error("[transplantBatchAction] Error:", e);
    
    if (e instanceof Error) {
      // Zod validation errors
      if (e.name === "ZodError") {
        return { success: false, error: "Invalid input data" };
      }
      return { success: false, error: e.message };
    }
    
    return { success: false, error: "An unexpected error occurred" };
  }
}







