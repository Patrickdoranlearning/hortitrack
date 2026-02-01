import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import { consumeMaterialsForBatch } from "@/server/materials/consumption";

/**
 * Worker Propagation API
 *
 * Mobile-optimized endpoint for creating propagation batches.
 * Creates a new batch from seeds/cuttings (no parent batch required).
 */

const PropagateSchema = z.object({
  plantVarietyId: z.string().uuid("Invalid variety ID"),
  sizeId: z.string().uuid("Invalid size ID"),
  locationId: z.string().uuid("Invalid location ID"),
  containers: z.number().int().positive("Containers must be positive"),
  plantedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await req.json();
    const input = PropagateSchema.parse(body);
    const { supabase, orgId, user } = await getUserAndOrg();

    // Verify variety exists
    const { data: variety, error: varietyError } = await supabase
      .from("plant_varieties")
      .select("id, name")
      .eq("id", input.plantVarietyId)
      .eq("org_id", orgId)
      .single();

    if (varietyError || !variety) {
      return NextResponse.json(
        { error: "Variety not found", requestId },
        { status: 400 }
      );
    }

    // Get size details for quantity calculation
    const { data: size, error: sizeError } = await supabase
      .from("plant_sizes")
      .select("id, name, cell_multiple")
      .eq("id", input.sizeId)
      .eq("org_id", orgId)
      .single();

    if (sizeError || !size) {
      return NextResponse.json(
        { error: "Size not found", requestId },
        { status: 400 }
      );
    }

    // Verify location exists
    const { data: location, error: locationError } = await supabase
      .from("nursery_locations")
      .select("id, name")
      .eq("id", input.locationId)
      .eq("org_id", orgId)
      .single();

    if (locationError || !location) {
      return NextResponse.json(
        { error: "Location not found", requestId },
        { status: 400 }
      );
    }

    // Calculate total quantity
    const cellMultiple = size.cell_multiple ?? 1;
    const totalQuantity = input.containers * Math.max(1, cellMultiple);

    // Generate batch number using the sequence
    const { data: seqData, error: seqError } = await supabase.rpc(
      "next_batch_seq",
      { p_org_id: orgId }
    );

    if (seqError) {
      logger.worker.error("Failed to get batch sequence", seqError, { requestId });
      return NextResponse.json(
        { error: "Failed to generate batch number", requestId },
        { status: 500 }
      );
    }

    // Format: YYWW-SEQ (e.g., 2605-001)
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const week = Math.ceil(
      ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
    ).toString().padStart(2, "0");
    const seq = (seqData as number).toString().padStart(3, "0");
    const batchNumber = `${year}${week}-${seq}`;

    // Create the batch
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: batchNumber,
        plant_variety_id: input.plantVarietyId,
        size_id: input.sizeId,
        location_id: input.locationId,
        quantity: totalQuantity,
        initial_quantity: totalQuantity,
        phase: "Propagation",
        status: "Growing",
        planted_at: input.plantedAt || new Date().toISOString().split("T")[0],
        notes: input.notes || null,
        created_by: user.id,
      })
      .select("id, batch_number, quantity, phase, status")
      .single();

    if (batchError || !batch) {
      logger.worker.error("Failed to create batch", batchError, { requestId });
      return NextResponse.json(
        { error: "Failed to create batch", requestId },
        { status: 500 }
      );
    }

    // Log the creation event
    await supabase.from("batch_events").insert({
      batch_id: batch.id,
      org_id: orgId,
      type: "CREATE",
      by_user_id: user.id,
      payload: {
        phase: "Propagation",
        quantity: totalQuantity,
        containers: input.containers,
        size_id: input.sizeId,
        location_id: input.locationId,
        note: input.notes ?? null,
      },
      request_id: requestId,
    });

    // Consume materials for the new batch
    try {
      await consumeMaterialsForBatch(
        supabase,
        orgId,
        user.id,
        batch.id,
        batch.batch_number,
        input.sizeId,
        totalQuantity,
        input.locationId,
        true // allowPartial
      );
    } catch (consumeErr) {
      // Log but don't fail - material consumption is non-blocking
      logger.worker.error("Material consumption failed", consumeErr, {
        requestId,
        batchId: batch.id,
      });
    }

    // Create plant passport if applicable
    try {
      // Get org settings for passport
      const { data: orgSettings } = await supabase
        .from("organisation_settings")
        .select("producer_code, country_code")
        .eq("org_id", orgId)
        .single();

      if (orgSettings?.producer_code) {
        await supabase.from("plant_passports").insert({
          batch_id: batch.id,
          org_id: orgId,
          operator_reg_no: orgSettings.producer_code,
          country_of_origin: orgSettings.country_code || "IE",
          traceability_code: batchNumber,
        });
      }
    } catch (passportErr) {
      // Log but don't fail
      logger.worker.error("Passport creation failed", passportErr, {
        requestId,
        batchId: batch.id,
      });
    }

    return NextResponse.json({
      ok: true,
      requestId,
      batch: {
        id: batch.id,
        batchNumber: batch.batch_number,
        quantity: batch.quantity,
        phase: batch.phase,
        status: batch.status,
      },
    });
  } catch (error) {
    logger.worker.error("Propagate endpoint error", error, { requestId });

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
      { error: "Failed to create propagation", requestId },
      { status: 500 }
    );
  }
}
