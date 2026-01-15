import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LinkBatchesSchema = z.object({
  batchIds: z.array(z.string().uuid()).min(1),
});

const UnlinkBatchesSchema = z.object({
  batchIds: z.array(z.string().uuid()).min(1),
});

type RouteParams = { params: Promise<{ id: string }> };

// POST - Link existing batches to a batch plan
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: batchPlanId } = await params;
    const payload = LinkBatchesSchema.parse(await req.json());
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
        { error: "You don't have permission to link batches in this organization" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Verify batch plan exists and belongs to org
    const { data: batchPlan, error: bpError } = await admin
      .from("batch_plans")
      .select("id, org_id, plant_variety_id")
      .eq("id", batchPlanId)
      .eq("org_id", orgId)
      .single();

    if (bpError || !batchPlan) {
      return NextResponse.json({ error: "Batch plan not found" }, { status: 404 });
    }

    // Update batches to link them to the batch plan
    const { data: updated, error: updateError } = await admin
      .from("batches")
      .update({
        batch_plan_id: batchPlanId,
        updated_at: new Date().toISOString()
      })
      .in("id", payload.batchIds)
      .eq("org_id", orgId)
      .select("id, batch_number");

    if (updateError) {
      console.error("[link-batches POST] update failed:", updateError);
      throw new Error(updateError.message);
    }

    // Log event for each batch
    for (const batch of updated ?? []) {
      await supabase.from("batch_events").insert({
        org_id: orgId,
        batch_id: batch.id,
        type: "LINKED_TO_PLAN",
        by_user_id: user.id,
        payload: {
          batchPlanId,
          action: "linked",
        },
      });
    }

    return NextResponse.json({
      linked: (updated ?? []).length,
      batches: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to link batches";
    console.error("[link-batches POST] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE - Unlink batches from a batch plan
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id: batchPlanId } = await params;
    const payload = UnlinkBatchesSchema.parse(await req.json());
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
        { error: "You don't have permission to unlink batches in this organization" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Update batches to unlink them from the batch plan
    const { data: updated, error: updateError } = await admin
      .from("batches")
      .update({
        batch_plan_id: null,
        updated_at: new Date().toISOString()
      })
      .in("id", payload.batchIds)
      .eq("batch_plan_id", batchPlanId)
      .eq("org_id", orgId)
      .select("id, batch_number");

    if (updateError) {
      console.error("[link-batches DELETE] update failed:", updateError);
      throw new Error(updateError.message);
    }

    // Log event for each batch
    for (const batch of updated ?? []) {
      await supabase.from("batch_events").insert({
        org_id: orgId,
        batch_id: batch.id,
        type: "UNLINKED_FROM_PLAN",
        by_user_id: user.id,
        payload: {
          batchPlanId,
          action: "unlinked",
        },
      });
    }

    return NextResponse.json({
      unlinked: (updated ?? []).length,
      batches: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to unlink batches";
    console.error("[link-batches DELETE] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
