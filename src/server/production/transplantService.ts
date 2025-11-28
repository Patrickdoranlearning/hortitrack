// src/server/production/transplantService.ts
import { z } from "zod";
import { TransplantRequestSchema, type TransplantRequest } from "@/lib/validators/transplant";
import { inferPhase } from "@/lib/production/phase";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";
import { getActiveOrgId } from "@/server/auth/org";

export async function performTransplant(inputRaw: TransplantRequest) {
  const sb = await getSupabaseForRequest();
  const orgId = await getActiveOrgId(sb);
  const input = TransplantRequestSchema.parse(inputRaw);

  // 1) Load parent batch (with variety/supplier) and ensure org matches
  const { data: parent, error: pErr } = await sb
    .from("batches")
    .select("id, org_id, batch_number, plant_variety_id, supplier_id, size_id, location_id, quantity, status")
    .eq("id", input.parentBatchId)
    .maybeSingle();
  if (pErr || !parent) throw new Error("Parent batch not found");
  if (parent.org_id !== orgId) throw new Error("Parent batch not in active org");

  // 2) Load chosen Size (cell_multiple & container_type) and Location
  const { data: size, error: sErr } = await sb
    .from("plant_sizes")
    .select("id, container_type, cell_multiple")
    .eq("id", input.newSizeId)
    .maybeSingle();
  if (sErr || !size) throw new Error("Size not found");

  const { data: loc, error: lErr } = await sb
    .from("nursery_locations")
    .select("id")
    .eq("id", input.newLocationId)
    .maybeSingle();
  if (lErr || !loc) throw new Error("Location not found");

  const sizeMultiple = Number(size.cell_multiple ?? 1); // trays>1, pots=1
  const unitsToProduce = input.containers * sizeMultiple;

  if (unitsToProduce <= 0) throw new Error("Nothing to transplant");
  if (unitsToProduce > parent.quantity) {
    throw new Error(`Requested ${unitsToProduce} units > parent available ${parent.quantity}`);
  }

  // 3) Determine phase
  const phase = inferPhase({ containerType: size.container_type as "pot" | "tray", cellMultiple: sizeMultiple });

  // 4) Generate child batch number if missing (Phase-YYWW-seq5) — minimal placeholder: keep manual when provided.
  const childBatchNumber = input.newBatchNumber ?? `T-${Date.now().toString().slice(-5)}`;

  // 5) Create child batch
  const newBatchInsert = {
    org_id: orgId,
    batch_number: childBatchNumber,
    phase, // text enum in DB (production_phase)
    supplier_id: parent.supplier_id ?? null,
    plant_variety_id: parent.plant_variety_id,
    size_id: input.newSizeId,
    location_id: input.newLocationId,
    status: "Growing", // default per schema; explicit for clarity
    quantity: unitsToProduce,
    initial_quantity: unitsToProduce,
    quantity_produced: unitsToProduce,
    unit: "plants",
    passport_override_a: input.passportOverrideA ?? null,
    passport_override_b: input.passportOverrideB ?? null,
    passport_override_c: input.passportOverrideC ?? null,
    passport_override_d: input.passportOverrideD ?? null,
  };

  const { data: childRows, error: cErr } = await sb
    .from("batches")
    .insert(newBatchInsert)
    .select("id, batch_number")
    .limit(1);
  if (cErr || !childRows?.length) throw new Error(`Failed to create child batch: ${cErr?.message ?? "unknown"}`);
  const child = childRows[0];

  // 6) Link ancestry
  const anc = {
    org_id: orgId,
    parent_batch_id: parent.id,
    child_batch_id: child.id,
    proportion: Number(unitsToProduce) / Number(parent.quantity || unitsToProduce),
  };
  const { error: aErr } = await sb.from("batch_ancestry").insert(anc);
  if (aErr) throw new Error(`Failed to link ancestry: ${aErr.message}`);

  // 7) Decrement parent quantity; optionally dump & archive remainder
  const remaining = parent.quantity - unitsToProduce;

  const updates: Record<string, any> = { quantity: remaining };
  if (input.dumpAndArchiveRemainder && remaining > 0) {
    updates.quantity = 0;
    updates.archived_at = new Date().toISOString();
  }

  const { error: uErr } = await sb.from("batches").update(updates).eq("id", parent.id);
  if (uErr) throw new Error(`Failed to update parent batch: ${uErr.message}`);

  // 8) Events
  const now = new Date().toISOString();
  const events = [
    {
      org_id: orgId,
      batch_id: parent.id,
      type: "TRANSPLANT_OUT",
      at: now,
      payload: {
        child_batch_id: child.id,
        child_batch_number: child.batch_number,
        containers: input.containers,
        size_multiple: sizeMultiple,
        units_moved: unitsToProduce,
        parent_remaining_after: input.dumpAndArchiveRemainder ? 0 : remaining,
        dump_and_archive_remainder: input.dumpAndArchiveRemainder,
      },
    },
    {
      org_id: orgId,
      batch_id: child.id,
      type: "TRANSPLANT_IN",
      at: now,
      payload: {
        parent_batch_id: parent.id,
        parent_batch_number: parent.batch_number,
        containers: input.containers,
        size_multiple: sizeMultiple,
        units_received: unitsToProduce,
        phase,
        size_id: input.newSizeId,
        location_id: input.newLocationId,
      },
    },
  ];

  if (input.dumpAndArchiveRemainder && remaining > 0) {
    events.push({
      org_id: orgId,
      batch_id: parent.id,
      type: "DUMP",
      at: now,
      payload: { units_dumped: remaining, reason: "Transplant remainder dumped & archived" },
    });
  }

  const { error: eErr } = await sb.from("batch_events").insert(events);
  if (eErr) throw new Error(`Failed to record events: ${eErr.message}`);

  return {
    childBatchId: child.id as string,
    childBatchNumber: child.batch_number as string,
    parentRemainingUnits: input.dumpAndArchiveRemainder ? 0 : remaining,
  };
}
