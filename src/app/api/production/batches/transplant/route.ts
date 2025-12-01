import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { TransplantInputSchema } from "@/lib/production/schemas";
import { getUserAndOrg } from "@/server/auth/org";
import { nextBatchNumber } from "@/server/numbering/batches";
import { ensureInternalSupplierId } from "@/server/suppliers/getInternalSupplierId";

type Phase = "propagation" | "plug" | "potted";
const PhaseMapToNumber: Record<Phase, 1|2|3> = { propagation: 1, plug: 2, potted: 3 };

function inferPhase(containerType: string | null, cellMultiple: number | null): Phase {
  // Heuristic: pots (or multiple==1) => potted; otherwise plug.
  if (containerType === "pot" || (cellMultiple ?? 0) === 1) return "potted";
  return "plug";
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const input = TransplantInputSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();
    const internalSupplierId = await ensureInternalSupplierId(supabase, orgId);

    // 1) Load parent batch (org-scoped)
    const { data: parent, error: pErr } = await supabase
      .from("batches")
      .select("id, org_id, plant_variety_id, size_id, location_id, quantity, phase, batch_number")
      .eq("id", input.parent_batch_id)
      .eq("org_id", orgId)
      .single();
    if (pErr || !parent) throw new Error("Parent batch not found");

    // 2) Load new size to compute units + phase
    const { data: size, error: sErr } = await supabase
      .from("plant_sizes")
      .select("id, container_type, cell_multiple")
      .eq("id", input.size_id)
      .single();
    if (sErr || !size) throw new Error("Invalid size selection");

    const newPhase = inferPhase((size as any).container_type ?? null, (size as any).cell_multiple ?? null);
    const factor = (size as any).cell_multiple ?? 1;
    const childUnits = input.containers * factor;

    // 3) Generate child batch number for target phase
    const batchNo = await nextBatchNumber(PhaseMapToNumber[newPhase]);

    // 4) Create child batch
    const { data: child, error: cErr } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: batchNo,
        phase: newPhase,
        plant_variety_id: parent.plant_variety_id,
        size_id: input.size_id,
        location_id: input.location_id,
        status: "Growing",
        supplier_id: internalSupplierId,
        quantity: childUnits,
        initial_quantity: childUnits,
        unit: "plants",
        planted_at: input.planted_at ?? null,
      })
      .select("id, batch_number, quantity, phase")
      .single();
    if (cErr || !child) throw new Error(cErr?.message ?? "Child batch insert failed");

    // 5) Atomically decrement parent quantity via RPC
    const { data: newQty, error: dErr } = await supabase.rpc("decrement_batch_quantity", {
      p_org_id: orgId, p_batch_id: parent.id, p_units: childUnits
    });
    if (dErr) {
      // Clean up child on failure
      await supabase.from("batches").delete().eq("id", child.id);
      throw new Error(`Unable to decrement parent: ${dErr.message}`);
    }

    // 6) Link ancestry (single parent -> child; proportion = 1.0)
    const { error: aErr } = await supabase.from("batch_ancestry").insert({
      org_id: orgId,
      parent_batch_id: parent.id,
      child_batch_id: child.id,
      proportion: 1, // 100% from single parent
    });
    if (aErr) {
      // Attempt to revert: delete child; re-increment parent (best-effort)
      await supabase.from("batches").delete().eq("id", child.id);
      // re-credit parent
      await supabase.rpc("decrement_batch_quantity", { p_org_id: orgId, p_batch_id: parent.id, p_units: -childUnits })
        .catch(() => {}); // swallow if fails
      throw new Error(`Ancestry link failed: ${aErr.message}`);
    }

    // 7) Events (one on parent, one on child)
    await supabase.from("batch_events").insert([
      {
        batch_id: parent.id,
        org_id: orgId,
        type: "TRANSPLANT_OUT",
        by_user_id: user.id,
        payload: {
          to_batch_id: child.id,
          to_batch_number: child.batch_number,
          units_moved: childUnits,
          new_parent_quantity: newQty,
          note: input.notes ?? null,
        },
        request_id: requestId,
      },
      {
        batch_id: child.id,
        org_id: orgId,
        type: "TRANSPLANT_IN",
        by_user_id: user.id,
        payload: {
          from_batch_id: parent.id,
          from_batch_number: parent.batch_number,
          containers: input.containers,
          size_multiple: factor,
          computed_units: childUnits,
          note: input.notes ?? null,
        },
        request_id: requestId,
      }
    ]);

    // 8) Child gets an internal passport at transplant time
    await supabase.from("batch_passports").insert({
      batch_id: child.id,
      org_id: orgId,
      passport_type: "internal",
      operator_reg_no: "IE2727",
      traceability_code: child.batch_number,
      origin_country: "IE",
      created_by_user_id: user.id,
      // request_id is not a column on passports; omit.
    });

    // 9) Optionally archive parent if empty
    if (newQty === 0 && (input.archive_parent_if_empty ?? true)) {
      await supabase
        .from("batches")
        .update({ status: "Archived", archived_at: new Date().toISOString() })
        .eq("id", parent.id)
        .eq("org_id", orgId);
      await supabase.from("batch_events").insert({
        batch_id: parent.id,
        org_id: orgId,
        type: "ARCHIVE",
        by_user_id: user.id,
        payload: { reason: "Transplanted all units" },
        request_id: requestId,
      });
    }

    return NextResponse.json({
      requestId,
      child_batch: child,
      parent_new_quantity: newQty,
    }, { status: 201 });

  } catch (e: any) {
    console.error("[batches/transplant]", { requestId, error: e?.message });
    const status =
      /Unauthenticated/i.test(e?.message) ? 401 :
      /parse|invalid/i.test(e?.message) ? 400 :
      /not found|insufficient/i.test(e?.message) ? 409 : 500;
    return NextResponse.json({ error: e?.message ?? "Server error", requestId }, { status });
  }
}
