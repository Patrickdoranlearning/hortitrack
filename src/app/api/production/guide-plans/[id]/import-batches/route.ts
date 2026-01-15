import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ImportBatchesSchema = z.object({
  // Group by variety - each variety will get its own batch plan
  varieties: z.array(z.object({
    varietyId: z.string().uuid(),
    batchIds: z.array(z.string().uuid()).min(1),
  })).min(1),
});

type RouteParams = { params: Promise<{ id: string }> };

// POST - Create batch plans from existing batches and link them
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: guidePlanId } = await params;
    const payload = ImportBatchesSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    // Verify user has org membership
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have permission to import batches in this organization" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Verify guide plan exists and belongs to org
    const { data: guidePlan, error: gpError } = await admin
      .from("guide_plans")
      .select(`
        id,
        org_id,
        target_family,
        target_size_id,
        ready_from_week,
        ready_from_year,
        ready_to_week,
        ready_to_year,
        protocol_id
      `)
      .eq("id", guidePlanId)
      .eq("org_id", orgId)
      .single();

    if (gpError || !guidePlan) {
      return NextResponse.json({ error: "Guide plan not found" }, { status: 404 });
    }

    const results: {
      batchPlansCreated: number;
      batchesLinked: number;
      totalQuantity: number;
      errors: string[];
    } = {
      batchPlansCreated: 0,
      batchesLinked: 0,
      totalQuantity: 0,
      errors: [],
    };

    // Process each variety group
    for (const varietyGroup of payload.varieties) {
      try {
        // Get the batches to calculate total quantity
        const { data: batches, error: batchError } = await admin
          .from("batches")
          .select("id, quantity, size_id")
          .in("id", varietyGroup.batchIds)
          .eq("org_id", orgId)
          .is("batch_plan_id", null); // Only unlinked batches

        if (batchError || !batches || batches.length === 0) {
          results.errors.push(`No valid batches found for variety ${varietyGroup.varietyId}`);
          continue;
        }

        // Calculate total quantity from the batches
        const totalQuantity = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);

        // Use the size from the first batch if guide plan doesn't specify one
        const sizeId = guidePlan.target_size_id ?? batches[0].size_id;

        // Create batch plan for this variety
        const { data: batchPlan, error: bpError } = await admin
          .from("batch_plans")
          .insert({
            org_id: orgId,
            guide_plan_id: guidePlanId,
            plant_variety_id: varietyGroup.varietyId,
            target_size_id: sizeId,
            planned_quantity: totalQuantity,
            ready_from_week: guidePlan.ready_from_week,
            ready_from_year: guidePlan.ready_from_year,
            ready_to_week: guidePlan.ready_to_week,
            ready_to_year: guidePlan.ready_to_year,
            protocol_id: guidePlan.protocol_id,
            status: 'active', // Already has batches, so it's active
            notes: `Auto-created from ${batches.length} existing batch${batches.length !== 1 ? 'es' : ''}`,
          })
          .select("id")
          .single();

        if (bpError || !batchPlan) {
          results.errors.push(`Failed to create batch plan for variety ${varietyGroup.varietyId}: ${bpError?.message}`);
          continue;
        }

        results.batchPlansCreated++;

        // Link the batches to this batch plan
        const { error: linkError } = await admin
          .from("batches")
          .update({
            batch_plan_id: batchPlan.id,
            updated_at: new Date().toISOString(),
          })
          .in("id", varietyGroup.batchIds)
          .eq("org_id", orgId);

        if (linkError) {
          results.errors.push(`Failed to link batches for variety ${varietyGroup.varietyId}: ${linkError.message}`);
          continue;
        }

        results.batchesLinked += batches.length;
        results.totalQuantity += totalQuantity;

        // Log events for each batch
        for (const batch of batches) {
          await supabase.from("batch_events").insert({
            org_id: orgId,
            batch_id: batch.id,
            type: "LINKED_TO_PLAN",
            by_user_id: user.id,
            payload: {
              batchPlanId: batchPlan.id,
              guidePlanId,
              action: "imported",
            },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.errors.push(`Error processing variety ${varietyGroup.varietyId}: ${message}`);
      }
    }

    // Update guide plan status to active if it was draft and we linked batches
    if (results.batchesLinked > 0) {
      await admin
        .from("guide_plans")
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq("id", guidePlanId)
        .eq("status", "draft");
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to import batches";
    console.error("[guide-plan import-batches POST] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
