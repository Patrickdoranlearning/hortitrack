import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { ensureVirtualLocation } from "@/server/locations/virtual";
import { inferPhase } from "@/lib/production/phase";
import { nextBatchNumber } from "@/server/numbering/batches";
import { computeRouteSchedule } from "@/lib/planning/schedule";
import type { ProductionProtocolRoute } from "@/lib/protocol-types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Resolve status_id from attribute_options
async function resolveStatusId(
  supabase: SupabaseClient,
  orgId: string,
  statusCode: string
): Promise<string | null> {
  const { data } = await supabase
    .from("attribute_options")
    .select("id")
    .eq("org_id", orgId)
    .eq("attribute_key", "production_status")
    .ilike("system_code", statusCode)
    .maybeSingle();

  if (data) return data.id;

  // Fallback to Growing if not found
  const { data: fallback } = await supabase
    .from("attribute_options")
    .select("id")
    .eq("org_id", orgId)
    .eq("attribute_key", "production_status")
    .eq("system_code", "Growing")
    .maybeSingle();

  return fallback?.id ?? null;
}

const DateOnly = /^\d{4}-\d{2}-\d{2}$/;

const PlannedBatchSchema = z
  .object({
    parentBatchId: z.string().uuid().optional(),
    plantVarietyId: z.string().uuid().optional(),
    sizeId: z.string().uuid(),
    units: z.number().int().positive(),
    targetReadyDate: z.string().regex(DateOnly, "Use YYYY-MM-DD"),
    protocolId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    label: z.string().max(120).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (val) => Boolean(val.parentBatchId || val.plantVarietyId),
    "Provide a parent batch or a plant variety"
  );

const PHASE_COUNTER: Record<string, 1 | 2 | 3> = {
  propagation: 1,
  plug: 2,
  potted: 3,
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const payload = PlannedBatchSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    const { data: size, error: sizeErr } = await supabase
      .from("plant_sizes")
      .select("id, container_type, cell_multiple")
      .eq("id", payload.sizeId)
      .single();
    if (sizeErr || !size) throw new Error("Invalid size selection");

    const parent = payload.parentBatchId
      ? await supabase
          .from("batches")
          .select("id, plant_variety_id, supplier_id, size_id, quantity, reserved_quantity")
          .eq("id", payload.parentBatchId)
          .eq("org_id", orgId)
          .maybeSingle()
      : { data: null, error: null };

    if (payload.parentBatchId && parent.error) {
      throw new Error(parent.error.message);
    }

    if (payload.parentBatchId && !parent?.data) {
      return NextResponse.json({ error: "Parent batch not found" }, { status: 404 });
    }

    // Check if parent has enough available quantity for this allocation
    if (parent?.data) {
      const currentQty = parent.data.quantity ?? 0;
      const reservedQty = parent.data.reserved_quantity ?? 0;
      const availableQty = currentQty - reservedQty;

      if (payload.units > availableQty) {
        return NextResponse.json(
          {
            error: `Insufficient available quantity. Parent batch has ${availableQty.toLocaleString()} available (${currentQty.toLocaleString()} total - ${reservedQty.toLocaleString()} reserved).`,
          },
          { status: 400 }
        );
      }
    }

    const varietyId = payload.plantVarietyId ?? parent?.data?.plant_variety_id;
    if (!varietyId) {
      return NextResponse.json({ error: "Variety is required" }, { status: 400 });
    }

    const { data: protocol } = payload.protocolId
      ? await supabase
          .from("protocols")
          .select("id, route")
          .eq("id", payload.protocolId)
          .eq("org_id", orgId)
          .maybeSingle()
      : { data: null };

    const schedule = protocol?.route
      ? computeRouteSchedule(protocol.route as ProductionProtocolRoute, payload.targetReadyDate)
      : {
          startDate: payload.targetReadyDate,
          readyDate: payload.targetReadyDate,
          nodes: [],
          totalDurationDays: 0,
        };

    const locationId =
      payload.locationId ?? (await ensureVirtualLocation(supabase, orgId, "planning"));

    const sizeMultiple = Number(size.cell_multiple ?? 1) || 1;
    const phase = inferPhase({
      containerType: (size.container_type as "pot" | "tray") ?? "pot",
      cellMultiple: sizeMultiple,
    });
    const phaseCounter = PHASE_COUNTER[phase] ?? 2;
    const batchNumber = await nextBatchNumber(phaseCounter);

    // Resolve status_id for "Planned" status
    const statusId = await resolveStatusId(supabase, orgId, "Planned");
    if (!statusId) {
      return NextResponse.json({ error: "Could not resolve status. Please ensure 'Planned' status exists in your organization settings." }, { status: 400 });
    }

    const { data: batch, error } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: batchNumber,
        phase,
        plant_variety_id: varietyId,
        size_id: payload.sizeId,
        supplier_id: parent?.data?.supplier_id ?? null,
        location_id: locationId,
        status: "Planned",
        status_id: statusId,
        quantity: payload.units,
        initial_quantity: payload.units,
        unit: "plants",
        planted_at: schedule.startDate.slice(0, 10),
        ready_at: payload.targetReadyDate,
        supplier_batch_number: payload.label ?? "",
        parent_batch_id: payload.parentBatchId ?? null,
        protocol_id: payload.protocolId ?? null,
        log_history: [
          {
            type: "planned_allocation",
            targetReadyDate: payload.targetReadyDate,
            protocolId: payload.protocolId ?? null,
            notes: payload.notes ?? null,
          },
        ],
      })
      .select("*")
      .single();

    if (error || !batch) {
      throw new Error(error?.message ?? "Failed to create planned batch");
    }

    // Update parent batch's reserved_quantity to reflect the new allocation
    if (payload.parentBatchId && parent?.data) {
      const newReserved = (parent.data.reserved_quantity ?? 0) + payload.units;
      const { error: reserveErr } = await supabase
        .from("batches")
        .update({
          reserved_quantity: newReserved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.parentBatchId)
        .eq("org_id", orgId);

      if (reserveErr) {
        console.error("[planned] Failed to update reserved quantity:", reserveErr);
        // Note: We don't rollback the batch creation - the reservation is a soft lock
      }
    }

    await supabase.from("batch_events").insert({
      batch_id: batch.id,
      org_id: orgId,
      type: "PLAN_SPLIT",
      by_user_id: user.id,
      payload: {
        parent_batch_id: payload.parentBatchId ?? null,
        units_planned: payload.units,
        target_ready_date: payload.targetReadyDate,
        protocol_id: payload.protocolId ?? null,
        schedule,
        notes: payload.notes ?? null,
      },
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
    }
    const message = error?.message ?? "Failed to create planned batch";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

