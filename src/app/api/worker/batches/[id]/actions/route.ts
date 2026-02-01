import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

/**
 * Worker Batch Actions API
 *
 * Handles batch actions from the worker app:
 * - move: Change batch location
 * - loss: Record loss/dump
 * - spray: Log spray treatment
 * - water: Log watering
 * - feed: Log feeding
 * - observation: Log general observation
 */

const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"),
    locationId: z.string().uuid("Invalid location ID"),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("loss"),
    quantity: z.number().int().positive("Quantity must be positive"),
    reason: z.string().min(2, "Reason is required").max(200),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("spray"),
    productName: z.string().max(200).optional(),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("water"),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("feed"),
    productName: z.string().max(200).optional(),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("observation"),
    notes: z.string().min(1, "Note is required").max(500),
  }),
]);

export type WorkerBatchAction = z.infer<typeof ActionSchema>;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = randomUUID();

  try {
    const body = await req.json();
    const input = ActionSchema.parse(body);
    const { supabase, orgId, user } = await getUserAndOrg();

    // Verify batch exists and belongs to org
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select("id, batch_number, location_id, quantity")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: "Batch not found", requestId },
        { status: 404 }
      );
    }

    // Handle each action type
    switch (input.action) {
      case "move": {
        // Verify new location exists
        const { data: location, error: locError } = await supabase
          .from("nursery_locations")
          .select("id, name")
          .eq("id", input.locationId)
          .eq("org_id", orgId)
          .single();

        if (locError || !location) {
          return NextResponse.json(
            { error: "Location not found", requestId },
            { status: 400 }
          );
        }

        // Update batch location
        const { error: updateError } = await supabase
          .from("batches")
          .update({ location_id: input.locationId })
          .eq("id", batch.id)
          .eq("org_id", orgId);

        if (updateError) {
          throw updateError;
        }

        // Log event
        const { error: eventError } = await supabase.from("batch_events").insert({
          batch_id: batch.id,
          org_id: orgId,
          type: "MOVE",
          by_user_id: user.id,
          payload: {
            from_location_id: batch.location_id,
            to_location_id: input.locationId,
            note: input.notes ?? null,
          },
          request_id: requestId,
        });

        if (eventError) {
          // Log but don't fail - event logging shouldn't block the action
          logger.worker.error("Failed to log MOVE batch event", eventError, {
            batchId: batch.id,
            action: "MOVE",
            requestId,
          });
        }

        return NextResponse.json({
          ok: true,
          message: `Batch moved to ${location.name}`,
          requestId,
        });
      }

      case "loss": {
        // Check quantity available
        if (input.quantity > (batch.quantity ?? 0)) {
          return NextResponse.json(
            { error: "Loss quantity exceeds available stock", requestId },
            { status: 400 }
          );
        }

        // Atomic decrement
        const { data: newQty, error: decrementError } = await supabase.rpc(
          "decrement_batch_quantity",
          {
            p_org_id: orgId,
            p_batch_id: batch.id,
            p_units: input.quantity,
          }
        );

        if (decrementError) {
          return NextResponse.json(
            { error: decrementError.message, requestId },
            { status: 409 }
          );
        }

        // Log dump event
        const { error: dumpEventError } = await supabase.from("batch_events").insert({
          batch_id: batch.id,
          org_id: orgId,
          type: "DUMP",
          by_user_id: user.id,
          payload: {
            reason: input.reason,
            units: input.quantity,
            new_quantity: newQty,
            note: input.notes ?? null,
          },
          request_id: requestId,
        });

        if (dumpEventError) {
          logger.worker.error("Failed to log DUMP batch event", dumpEventError, {
            batchId: batch.id,
            action: "DUMP",
            requestId,
          });
        }

        // Archive if zero
        if ((newQty as number) === 0) {
          await supabase
            .from("batches")
            .update({
              status: "Archived",
              archived_at: new Date().toISOString(),
            })
            .eq("id", batch.id)
            .eq("org_id", orgId);

          const { error: archiveEventError } = await supabase.from("batch_events").insert({
            batch_id: batch.id,
            org_id: orgId,
            type: "ARCHIVE",
            by_user_id: user.id,
            payload: { reason: "Zero quantity after loss" },
            request_id: requestId,
          });

          if (archiveEventError) {
            logger.worker.error("Failed to log ARCHIVE batch event", archiveEventError, {
              batchId: batch.id,
              action: "ARCHIVE",
              requestId,
            });
          }
        }

        return NextResponse.json({
          ok: true,
          newQuantity: newQty,
          message: `Recorded loss of ${input.quantity} units`,
          requestId,
        });
      }

      case "spray":
      case "water":
      case "feed":
      case "observation": {
        // Map action type to event type
        const eventTypeMap: Record<string, string> = {
          spray: "SPRAY",
          water: "WATER",
          feed: "FEED",
          observation: "CHECKIN",
        };

        const eventType = eventTypeMap[input.action];
        const payload: Record<string, unknown> = {
          note: input.notes ?? null,
        };

        if ("productName" in input && input.productName) {
          payload.product_name = input.productName;
        }

        const { error: eventError } = await supabase.from("batch_events").insert({
          batch_id: batch.id,
          org_id: orgId,
          type: eventType,
          by_user_id: user.id,
          payload,
          request_id: requestId,
        });

        if (eventError) {
          logger.worker.error(`Failed to log ${eventType} batch event`, eventError, {
            batchId: batch.id,
            action: input.action,
            requestId,
          });
        }

        return NextResponse.json({
          ok: true,
          message: `${input.action.charAt(0).toUpperCase() + input.action.slice(1)} logged`,
          requestId,
        });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action type", requestId },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.worker.error("Batch action failed", error, { batchId: id, requestId });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", issues: error.errors, requestId },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to process action", requestId },
      { status: 500 }
    );
  }
}
