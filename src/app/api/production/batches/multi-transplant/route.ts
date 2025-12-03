import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { MultiTransplantInputSchema } from "@/lib/production/schemas";
import { getUserAndOrg } from "@/server/auth/org";
import { ensureInternalSupplierId } from "@/server/suppliers/getInternalSupplierId";
import { nextBatchNumber } from "@/server/numbering/batches";

type Phase = "propagation" | "plug" | "potted";
const PhaseMapToNumber: Record<Phase, 1 | 2 | 3> = { propagation: 1, plug: 2, potted: 3 };

function inferPhase(containerType: string | null, cellMultiple: number | null): Phase {
  if (containerType === "pot" || (cellMultiple ?? 0) <= 1) return "potted";
  if ((cellMultiple ?? 0) >= 3) return "plug";
  return "propagation";
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const payload = MultiTransplantInputSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    const requiredUnits = payload.child.packs * payload.child.units_per_pack;
    if (requiredUnits <= 0) {
      throw new Error("Nothing to produce");
    }
    const contributedUnits = payload.parents.reduce((sum, row) => sum + row.units, 0);
    if (contributedUnits !== requiredUnits) {
      throw new Error("Parent units must match the required output units");
    }

    // Load child size/location + compute phase
    const { data: sizeRow, error: sizeErr } = await supabase
      .from("plant_sizes")
      .select("id, container_type, cell_multiple")
      .eq("id", payload.child.size_id)
      .maybeSingle();
    if (sizeErr || !sizeRow) throw new Error("Invalid target size");
    const childPhase = inferPhase((sizeRow as any).container_type ?? null, (sizeRow as any).cell_multiple ?? 1);

    const parentIds = payload.parents.map((p) => p.parent_batch_id);
    const { data: parentRows, error: parentErr } = await supabase
      .from("batches")
      .select("id, quantity, batch_number, org_id")
      .in("id", parentIds)
      .eq("org_id", orgId);
    if (parentErr) throw new Error(parentErr.message);
    if (!parentRows || parentRows.length !== payload.parents.length) {
      throw new Error("Some parent batches were not found or not in this organisation");
    }

    payload.parents.forEach((inputRow) => {
      const parent = parentRows.find((p) => p.id === inputRow.parent_batch_id);
      if (!parent) throw new Error("Parent batch missing");
      if (inputRow.units > (parent.quantity ?? 0)) {
        throw new Error(`Parent ${parent.batch_number} lacks enough units`);
      }
    });

    const internalSupplierId = await ensureInternalSupplierId(supabase, orgId);
    const childBatchNumber = await nextBatchNumber(PhaseMapToNumber[childPhase]);

    const { data: child, error: childErr } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: childBatchNumber,
        phase: childPhase,
        plant_variety_id: payload.child.plant_variety_id,
        size_id: payload.child.size_id,
        location_id: payload.child.location_id,
        status: "Growing",
        supplier_id: internalSupplierId,
        quantity: requiredUnits,
        initial_quantity: requiredUnits,
        planted_at: payload.child.planted_at ?? null,
        unit: "plants",
      })
      .select("id, batch_number, quantity")
      .single();
    if (childErr || !child) throw new Error(childErr?.message ?? "Failed to create child batch");

    const decrementedParents: Array<{ id: string; units: number }> = [];
    const events: any[] = [];
    const ancestry: any[] = [];

    try {
      for (const row of payload.parents) {
        const { data: newQty, error: decErr } = await supabase.rpc("decrement_batch_quantity", {
          p_org_id: orgId,
          p_batch_id: row.parent_batch_id,
          p_units: row.units,
        });
        if (decErr) throw new Error(decErr.message);
        decrementedParents.push({ id: row.parent_batch_id, units: row.units });

        ancestry.push({
          org_id: orgId,
          parent_batch_id: row.parent_batch_id,
          child_batch_id: child.id,
          proportion: row.units / requiredUnits,
        });

        events.push({
          batch_id: row.parent_batch_id,
          org_id: orgId,
          type: "TRANSPLANT_OUT",
          by_user_id: user.id,
          payload: {
            to_batch_id: child.id,
            to_batch_number: child.batch_number,
            units_moved: row.units,
            note: row.notes ?? null,
          },
          request_id: requestId,
        });

        if (newQty === 0 && row.archive_parent_if_empty) {
          await supabase
            .from("batches")
            .update({ status: "Archived", archived_at: new Date().toISOString() })
            .eq("id", row.parent_batch_id)
            .eq("org_id", orgId);
        }
      }
    } catch (err) {
      // rollback parent decrements and child batch
      await Promise.all(
        decrementedParents.map((parent) =>
          supabase.rpc("decrement_batch_quantity", {
            p_org_id: orgId,
            p_batch_id: parent.id,
            p_units: -parent.units,
          })
        )
      );
      await supabase.from("batches").delete().eq("id", child.id);
      throw err;
    }

    const { error: ancErr } = await supabase.from("batch_ancestry").insert(ancestry);
    if (ancErr) throw new Error(`Failed to link ancestry: ${ancErr.message}`);

    events.push({
      batch_id: child.id,
      org_id: orgId,
      type: "TRANSPLANT_IN",
      by_user_id: user.id,
      payload: {
        total_units: requiredUnits,
        parent_count: payload.parents.length,
        packs: payload.child.packs,
        units_per_pack: payload.child.units_per_pack,
      },
      request_id: requestId,
    });
    await supabase.from("batch_events").insert(events);

    await supabase.from("batch_passports").insert({
      batch_id: child.id,
      org_id: orgId,
      passport_type: "internal",
      operator_reg_no: "IE2727",
      traceability_code: child.batch_number,
      origin_country: "IE",
      created_by_user_id: user.id,
    });

    return NextResponse.json(
      {
        requestId,
        child_batch: child,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[batches/multi-transplant]", { requestId, error: err?.message });
    return NextResponse.json({ requestId, error: err?.message ?? "Server error" }, { status: 400 });
  }
}

