import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import { consumeMaterialsForBatch } from "@/server/materials/consumption";
import { workerTransplantSchema } from "@/lib/shared";

/**
 * Worker Transplant API
 *
 * Mobile-optimized endpoint for creating transplants.
 * Creates a child batch from a parent batch using the perform_transplant RPC.
 *
 * Uses shared schema from @/lib/shared/schemas/transplant.ts
 */

// Use the shared schema
const TransplantSchema = workerTransplantSchema;

export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await req.json();
    const input = TransplantSchema.parse(body);
    const { supabase, orgId, user } = await getUserAndOrg();

    // Call the transactional RPC function
    const rpcParams = {
      p_org_id: orgId,
      p_parent_batch_id: input.parentBatchId,
      p_size_id: input.sizeId,
      p_location_id: input.locationId,
      p_containers: input.containers,
      p_user_id: user.id,
      p_planted_at: new Date().toISOString().split("T")[0], // Today
      p_notes: input.notes ?? null,
      p_archive_parent_if_empty: input.archiveParentIfEmpty,
      p_units: null, // Let RPC calculate from containers
    };

    const { data, error } = await supabase.rpc("perform_transplant", rpcParams);

    if (error) {
      logger.worker.error("Transplant RPC failed", error, {
        requestId,
        parentBatchId: input.parentBatchId,
      });

      // Parse specific error messages for better UX
      if (error.message.includes("Insufficient quantity")) {
        return NextResponse.json(
          { error: "Not enough plants in the source batch", requestId },
          { status: 400 }
        );
      }
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "Batch not found or you don't have access", requestId },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: error.message, requestId },
        { status: 500 }
      );
    }

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

    // Consume materials for the new child batch
    try {
      await consumeMaterialsForBatch(
        supabase,
        orgId,
        user.id,
        result.child_batch.id,
        result.child_batch.batch_number,
        input.sizeId,
        result.child_batch.quantity,
        input.locationId,
        true // allowPartial
      );
    } catch (consumeErr) {
      // Log but don't fail - material consumption is non-blocking
      logger.worker.error("Material consumption failed", consumeErr, {
        requestId,
        batchId: result.child_batch.id,
      });
    }

    // Handle write-off remainder if requested
    if (input.writeOffRemainder && input.remainderUnits && input.remainderUnits > 0) {
      try {
        // Record the dump/loss for remainder
        const { error: dumpError } = await supabase.rpc(
          "decrement_batch_quantity",
          {
            p_org_id: orgId,
            p_batch_id: input.parentBatchId,
            p_units: input.remainderUnits,
          }
        );

        if (!dumpError) {
          // Log the dump event
          await supabase.from("batch_events").insert({
            batch_id: input.parentBatchId,
            org_id: orgId,
            type: "DUMP",
            by_user_id: user.id,
            payload: {
              reason: "Write-off after transplant",
              units: input.remainderUnits,
              note: "Remainder written off during transplant",
            },
            request_id: requestId,
          });
        }
      } catch (writeOffErr) {
        logger.worker.error("Write-off remainder failed", writeOffErr, {
          requestId,
          parentBatchId: input.parentBatchId,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      requestId,
      childBatch: {
        id: result.child_batch.id,
        batchNumber: result.child_batch.batch_number,
        quantity: result.child_batch.quantity,
        phase: result.child_batch.phase,
      },
      parentNewQuantity: result.parent_new_quantity,
    });
  } catch (error) {
    logger.worker.error("Transplant endpoint error", error, { requestId });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", issues: error.errors, requestId },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json(
        { error: "Unauthorized", requestId },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create transplant", requestId },
      { status: 500 }
    );
  }
}
