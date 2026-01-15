
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductionStatus } from "@/lib/types";
import { toMessage } from "@/lib/errors";
import { getBatchById, getBatchLogs, getBatchPhotos } from "@/server/batches/service";
import { createClient } from "@/lib/supabase/server"; // Keep this for PATCH/DELETE

type Params = { params: Promise<{ batchId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { batchId } = await params;
    const batch = await getBatchById(batchId);

    if (!batch) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    }

    // Photos (split by type)
    const photos = await getBatchPhotos(batchId);
    const photosSplit = {
      grower: (photos || []).filter((p: any) => p.type === "GROWER"),
      sales: (photos || []).filter((p: any) => p.type === "SALES")
    };

    // Logs
    const logs = await getBatchLogs(batchId);

    // Ancestry (simplified for now, or reuse buildBatchRoute logic if needed)
    // For now, let's just return empty ancestry or basic parent info
    const ancestry: any[] = [];
    if (batch.parentBatchId) {
      const parent = await getBatchById(batch.parentBatchId);
      if (parent) {
        ancestry.push({
          id: parent.id,
          batchNumber: parent.batchNumber,
          plantVariety: parent.plantVariety,
          plantFamily: parent.plantFamily,
          size: parent.size,
          supplier: parent.supplierName,
          producedWeek: parent.producedAt // approximate
        });
      }
    }

    return NextResponse.json({ ok: true, data: { batch, logs, photos: photosSplit, ancestry } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: { code: "SERVER_ERROR", message: toMessage(e) } }, { status: 500 });
  }
}

const PatchBody = z.object({
  // explicitly allow only updatable fields
  category: z.string().min(1).optional(),
  plantFamily: z.string().min(1).optional(),
  plantVariety: z.string().min(1).optional(),
  plantingDate: z.string().optional(), // ISO
  quantity: z.number().int().nonnegative().optional(),
  saleable_quantity: z.number().int().nonnegative().nullable().optional(),
  status: ProductionStatus.optional(),
  location: z.string().optional(),
  size: z.string().optional(),
  supplier: z.string().optional(),
  growerPhotoUrl: z.string().optional(),
  salesPhotoUrl: z.string().optional(),
}).strict();

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { batchId } = await params;
    const updates = PatchBody.parse(await req.json());
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Get active org
    let activeOrgId: string | null = null;
    const { data: profile } = await supabase.from('profiles').select('active_org_id').eq('id', user.id).single();
    if (profile?.active_org_id) {
      activeOrgId = profile.active_org_id;
    } else {
      const { data: membership } = await supabase.from('org_memberships').select('org_id').eq('user_id', user.id).limit(1).single();
      if (membership) activeOrgId = membership.org_id;
    }

    if (!activeOrgId) return NextResponse.json({ error: "No active organization found" }, { status: 400 });

    const { data: stored, error: fetchError } = await supabase.from("batches").select("*").eq("id", batchId).single();

    if (fetchError || !stored) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Resolve IDs if fields are present
    let varietyId = undefined;
    let sizeId = undefined;
    let locationId = undefined;
    let supplierId = undefined;

    if (updates.plantVariety) {
      const { data: v } = await supabase.from('plant_varieties').select('id').eq('name', updates.plantVariety).single();
      if (!v) return NextResponse.json({ error: `Variety '${updates.plantVariety}' not found` }, { status: 400 });
      varietyId = v.id;
    }

    if (updates.size) {
      const { data: s } = await supabase.from('plant_sizes').select('id').eq('name', updates.size).single();
      if (!s) return NextResponse.json({ error: `Size '${updates.size}' not found` }, { status: 400 });
      sizeId = s.id;
    }

    if (updates.location) {
      const { data: l } = await supabase.from('nursery_locations').select('id').eq('name', updates.location).eq('org_id', activeOrgId).single();
      if (!l) return NextResponse.json({ error: `Location '${updates.location}' not found` }, { status: 400 });
      locationId = l.id;
    }

    if (updates.supplier) {
      const { data: s } = await supabase.from('suppliers').select('id').eq('name', updates.supplier).eq('org_id', activeOrgId).single();
      if (!s) return NextResponse.json({ error: `Supplier '${updates.supplier}' not found` }, { status: 400 });
      supplierId = s.id;
    }

    const initialQty: number = stored.initial_quantity ?? 0;
    const nextQty: number = (typeof updates.quantity === "number") ? updates.quantity : stored.quantity ?? 0;
    const nextStatus: typeof stored.status = updates.status ?? stored.status;

    // Validate status is a known production status if provided
    if (updates.status) {
      const VALID_STATUSES = ['Active', 'Saleable', 'Growing', 'Archived', 'Hold', 'Propagation', 'Quarantine', 'Rejected'];
      if (!VALID_STATUSES.includes(updates.status)) {
        return NextResponse.json({
          error: `Invalid status: '${updates.status}'. Valid values: ${VALID_STATUSES.join(', ')}`
        }, { status: 400 });
      }
    }

    if (nextQty > initialQty) {
      return NextResponse.json({ error: "Quantity cannot exceed initial quantity." }, { status: 400 });
    }

    const shouldArchive = nextQty <= 0 || nextStatus === "Archived";
    const finalStatus = shouldArchive ? "Archived" : nextStatus;

    // Resolve status_id if status is changing or likely to be updated
    let statusId = undefined;
    if (finalStatus) {
      const { data: sOpt } = await supabase
        .from("attribute_options")
        .select("id")
        .eq("org_id", activeOrgId)
        .eq("attribute_key", "production_status")
        .or(`system_code.eq.${finalStatus},display_label.eq.${finalStatus}`)
        .single();
      if (sOpt) statusId = sOpt.id;
    }

    const serverUpdate: Record<string, any> = {
      // category: updates.category, // Removed from schema
      // plant_family: updates.plantFamily, // Removed from schema
      plant_variety_id: varietyId,
      planting_date: updates.plantingDate,
      location_id: locationId,
      size_id: sizeId,
      supplier_id: supplierId,
      grower_photo_url: updates.growerPhotoUrl,
      sales_photo_url: updates.salesPhotoUrl,
      quantity: shouldArchive ? 0 : nextQty,
      saleable_quantity: updates.saleable_quantity,
      status: finalStatus,
      status_id: statusId,
      updated_at: new Date().toISOString(),
    };

    // Remove undefined keys
    Object.keys(serverUpdate).forEach(key => serverUpdate[key] === undefined && delete serverUpdate[key]);

    const { data: updatedBatch, error: updateError } = await supabase
      .from("batches")
      .update(serverUpdate)
      .eq("id", batchId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log quantity change to batch_events if quantity was modified
    const qtyChanged = typeof updates.quantity === "number" && updates.quantity !== stored.quantity;
    if (qtyChanged) {
      const diff = (updates.quantity ?? 0) - (stored.quantity ?? 0);
      await supabase.from("batch_events").insert({
        org_id: activeOrgId,
        batch_id: batchId,
        type: "ADJUSTMENT",
        payload: {
          previousQuantity: stored.quantity,
          newQuantity: updates.quantity,
          diff,
          reason: "Manual adjustment",
        },
        by_user_id: user.id,
        at: new Date().toISOString(),
      });
    }

    // Log status change to batch_events if status was modified
    const statusChanged = updates.status && updates.status !== stored.status;
    if (statusChanged || (shouldArchive && stored.status !== "Archived")) {
      await supabase.from("batch_events").insert({
        org_id: activeOrgId,
        batch_id: batchId,
        type: "STATUS_CHANGE",
        payload: {
          previousStatus: stored.status,
          newStatus: finalStatus,
        },
        by_user_id: user.id,
        at: new Date().toISOString(),
      });
    }

    // Append auto-archive log if transitioning to Archived now
    const becameArchived = shouldArchive && stored.status !== "Archived";
    if (becameArchived) {
      await supabase.from("logs").insert({
        org_id: activeOrgId, // Added org_id
        batch_id: batchId,
        type: "ARCHIVE",
        note: "Batch quantity reached zero and was automatically archived.",
        date: new Date().toISOString(),
      });
    }

    return NextResponse.json({ id: updatedBatch.id, ...updatedBatch }); // Should map back to camelCase if needed
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: toMessage(e.errors), issues: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: toMessage(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { batchId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Get active org
    let activeOrgId: string | null = null;
    const { data: profile } = await supabase.from('profiles').select('active_org_id').eq('id', user.id).single();
    if (profile?.active_org_id) {
      activeOrgId = profile.active_org_id;
    } else {
      const { data: membership } = await supabase.from('org_memberships').select('org_id').eq('user_id', user.id).limit(1).single();
      if (membership) activeOrgId = membership.org_id;
    }

    if (!activeOrgId) return NextResponse.json({ error: "No active organization found" }, { status: 400 });

    // Resolve 'Archived' status_id
    const { data: sOpt } = await supabase
      .from("attribute_options")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("attribute_key", "production_status")
      .or(`system_code.eq.Archived,display_label.eq.Archived`)
      .single();

    const updatePayload: any = {
      status: "Archived",
      updated_at: new Date().toISOString()
    };
    if (sOpt) updatePayload.status_id = sOpt.id;

    const { error } = await supabase
      .from("batches")
      .update(updatePayload)
      .eq("id", batchId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: toMessage(e) }, { status: 500 });
  }
}
