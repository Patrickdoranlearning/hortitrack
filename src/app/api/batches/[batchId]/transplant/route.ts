
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer"; // Use Supabase client
// import { generateNextBatchId } from "@/server/batches/nextId"; // Assuming this will also be updated for Supabase
// import { switchPassportToInternal } from "@/server/batches/service"; // Assuming this will also be updated for Supabase

const Input = z.object({
  plantingDate: z.string().datetime(),
  quantity: z.number().int().positive(),
  size: z.string().min(1),
  locationId: z.string().optional().nullable(), // Allow null for locationId
  location: z.string().optional().nullable(),   // Allow null for location name
  logRemainingAsLoss: z.boolean().optional().default(false),
  notes: z.string().optional().nullable(),
});

function corsHeaders() {
  const allow =
    process.env.NODE_ENV === "development" ? "*" : undefined;
  return {
    "access-control-allow-origin": allow ?? "",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type,idempotency-key",
    "access-control-allow-credentials": "true",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const supabase = getSupabaseForRequest();
    const idemKey = req.headers.get("idempotency-key") ?? null;
    const body = await req.json();
    const parsed = Input.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map(i => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        },
        { status: 400, headers: corsHeaders() }
      );
    }
    const input = parsed.data;

    // TODO: Implement Supabase version of switchPassportToInternal
    // await switchPassportToInternal(params.batchId, userId);

    const param = params.batchId;

    // Resolve source batch by ID or batch_number
    let { data: src, error: srcError } = await supabase
      .from("batches")
      .select("*")
      .eq("id", param)
      .maybeSingle(); // Use maybeSingle to get null if not found

    if (srcError) throw srcError;

    if (!src) {
      // Try by batch_number if not found by ID
      const { data: byNumber, error: byNumberError } = await supabase
        .from("batches")
        .select("*")
        .eq("batch_number", param)
        .maybeSingle();
      if (byNumberError) throw byNumberError;
      src = byNumber; // Assign found batch (or null)
    }

    if (!src) {
      return NextResponse.json(
        { error: "source batch not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    const qty = input.quantity;

    if (qty > (src.quantity ?? 0)) {
      return NextResponse.json(
        { error: `quantity ${qty} exceeds available ${src.quantity}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    // TODO: Implement Supabase version of generateNextBatchId
    const childBatchNumber = "TEMP_BATCH_NUM"; // Placeholder

    let newBatchId: string | undefined = undefined;

    // Supabase transactions are typically handled as functions or stored procedures.
    // For an API route, we'll do a sequence of operations and handle potential errors.
    // For true atomicity, a Supabase function/trigger would be more robust.

    // Idempotency check
    if (idemKey) {
      const { data: idemData, error: idemError } = await supabase
        .from("idempotency") // Assuming an 'idempotency' table in Supabase
        .select("new_batch_id")
        .eq("id", `transplant:${src.id}:${idemKey}`)
        .maybeSingle();
      
      if (idemError) throw idemError;

      if (idemData?.new_batch_id) {
        // If idempotent key exists and has a new_batch_id, return existing
        const { data: existingBatch, error: existingBatchError } = await supabase
          .from("batches")
          .select("batch_number")
          .eq("id", idemData.new_batch_id)
          .single();
        if (existingBatchError) throw existingBatchError;
        return NextResponse.json(
          { ok: true, newBatch: { batchId: idemData.new_batch_id, batchNumber: existingBatch.batch_number } },
          { status: 200, headers: corsHeaders() }
        );
      }
      // Record idempotency key if not already present
      await supabase.from("idempotency").insert({
        id: `transplant:${src.id}:${idemKey}`,
        created_at: new Date().toISOString(),
      });
    }

    // Create new batch
    const newBatch = {
      org_id: src.org_id,
      batch_number: childBatchNumber,
      category: src.category, // Assuming category is directly on batch
      plant_family: src.plant_family, // Assuming plant_family is directly on batch
      plant_variety_id: src.plant_variety_id, // Link to existing variety
      planting_date: input.plantingDate,
      initial_quantity: qty,
      quantity: qty,
      status: "Propagation", 
      location_id: input.locationId, // Use ID if provided
      location: input.location,     // Use name if ID not available (or infer from ID)
      size_id: input.size,          // Assuming size is an ID now
      transplanted_from: src.batch_number,
      notes: input.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newBatchData, error: newBatchError } = await supabase
      .from("batches")
      .insert(newBatch)
      .select("id, batch_number")
      .single();

    if (newBatchError) throw newBatchError;
    newBatchId = newBatchData.id;

    // Update source batch
    const remaining = (src.quantity ?? 0) - qty;
    const srcPatch: Record<string, any> = {
      quantity: remaining,
      updated_at: new Date().toISOString(),
    };
    if (input.logRemainingAsLoss) srcPatch.status = "Archived";

    const { error: updateError } = await supabase
      .from("batches")
      .update(srcPatch)
      .eq("id", src.id);

    if (updateError) throw updateError;

    // Append history (assuming batch_logs table for history)
    await supabase.from("batch_logs").insert([
      {
        org_id: src.org_id,
        batch_id: src.id,
        type: "TRANSPLANT",
        note: `Transplanted ${qty} to ${childBatchNumber} (${input.size})`,
        qty_change: -qty, // Indicate reduction in source batch
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        org_id: src.org_id,
        batch_id: newBatchId,
        type: "BATCH_CREATED",
        note: `New batch from ${src.batch_number}`,
        qty_change: qty, // Indicate creation in new batch
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);

    // Update idempotency record with new batch ID
    if (idemKey && newBatchId) {
      await supabase.from("idempotency").update({ new_batch_id: newBatchId }).eq("id", `transplant:${src.id}:${idemKey}`);
    }

    return NextResponse.json(
      { ok: true, newBatch: { batchId: newBatchId, batchNumber: childBatchNumber } },
      { status: 201, headers: corsHeaders() }
    );
  } catch (e: any) {
    const msg = e?.message ?? "unknown error";
    const status = /not found/.test(msg)
      ? 404
      : /exceeds/.test(msg)
      ? 400
      : 500;
    console.error("Error in transplant route:", e);
    return NextResponse.json(
      { error: msg },
      { status, headers: corsHeaders() }
    );
  }
}
