import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { ensureVirtualLocation } from "@/server/locations/virtual";
import { inferPhase } from "@/lib/production/phase";
import { nextBatchNumber } from "@/server/numbering/batches";

const DateOnly = /^\d{4}-\d{2}-\d{2}$/;

const IncomingBatchSchema = z
  .object({
    plantVarietyId: z.string().uuid(),
    sizeId: z.string().uuid(),
    supplierId: z.string().uuid().optional(),
    units: z.number().int().positive().optional(),
    containers: z.number().int().positive().optional(),
    expectedDate: z.string().regex(DateOnly, "Use YYYY-MM-DD"),
    locationId: z.string().uuid().optional(),
    reference: z.string().max(120).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((val) => typeof val.units === "number" || typeof val.containers === "number", {
    message: "Provide units or containers",
    path: ["units"],
  });

const PHASE_COUNTER: Record<string, 1 | 2 | 3> = {
  propagation: 1,
  plug: 2,
  potted: 3,
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const payload = IncomingBatchSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    const { data: size, error: sizeErr } = await supabase
      .from("plant_sizes")
      .select("id, container_type, cell_multiple")
      .eq("id", payload.sizeId)
      .single();
    if (sizeErr || !size) throw new Error("Invalid size");

    const sizeMultiple = Number(size.cell_multiple ?? 1) || 1;
    const units =
      payload.units ??
      (payload.containers ? payload.containers * sizeMultiple : sizeMultiple);
    const containers = payload.containers ?? Math.ceil(units / sizeMultiple);

    const phase = inferPhase({
      containerType: (size.container_type as "pot" | "tray") ?? "pot",
      cellMultiple: sizeMultiple,
    });

    const locationId =
      payload.locationId ?? (await ensureVirtualLocation(supabase, orgId, "incoming"));

    const phaseCounter = PHASE_COUNTER[phase] ?? 2;
    const batchNumber = await nextBatchNumber(phaseCounter);

    const { data: batch, error } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: batchNumber,
        phase,
        plant_variety_id: payload.plantVarietyId,
        size_id: payload.sizeId,
        supplier_id: payload.supplierId ?? null,
        location_id: locationId,
        status: "Incoming",
        quantity: units,
        initial_quantity: units,
        unit: "plants",
        planted_at: payload.expectedDate,
        ready_at: payload.expectedDate,
        supplier_batch_number: payload.reference ?? "",
        log_history: [
          {
            type: "incoming_plan",
            units,
            containers,
            expectedDate: payload.expectedDate,
          },
        ],
      })
      .select("*")
      .single();

    if (error || !batch) {
      throw new Error(error?.message ?? "Failed to create incoming batch");
    }

    await supabase.from("batch_events").insert({
      batch_id: batch.id,
      org_id: orgId,
      type: "PLAN_INCOMING",
      by_user_id: user.id,
      payload: {
        expected_date: payload.expectedDate,
        units,
        containers,
        notes: payload.notes ?? null,
      },
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
    }
    const message = error?.message ?? "Failed to create incoming batch";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

