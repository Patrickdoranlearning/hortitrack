import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import type { WorkerBatchDetail } from "@/types/worker";

/**
 * Worker Batch Detail API
 *
 * Returns detailed batch information for the worker app.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, orgId } = await getUserAndOrg();

    const { data, error } = await supabase
      .from("batches")
      .select(`
        id,
        batch_number,
        plant_variety_id,
        plant_varieties(name, family),
        size_id,
        plant_sizes(name),
        location_id,
        nursery_locations(name),
        status,
        phase,
        quantity,
        initial_quantity,
        planted_at,
        ready_at,
        supplier_id,
        suppliers(name),
        notes,
        created_at
      `)
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    const batch: WorkerBatchDetail = {
      id: data.id,
      batchNumber: data.batch_number,
      varietyId: data.plant_variety_id,
      varietyName: (data.plant_varieties as { name?: string } | null)?.name ?? null,
      familyName: (data.plant_varieties as { family?: string } | null)?.family ?? null,
      sizeId: data.size_id,
      sizeName: (data.plant_sizes as { name?: string } | null)?.name ?? null,
      locationId: data.location_id,
      locationName: (data.nursery_locations as { name?: string } | null)?.name ?? null,
      status: data.status,
      phase: data.phase,
      quantity: data.quantity ?? 0,
      initialQuantity: data.initial_quantity ?? 0,
      plantedAt: data.planted_at,
      readyAt: data.ready_at,
      supplierName: (data.suppliers as { name?: string } | null)?.name ?? null,
      notes: data.notes,
      createdAt: data.created_at,
    };

    return NextResponse.json(batch);
  } catch (error) {
    console.error("[api/worker/batches/[id]] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to load batch" },
      { status: 500 }
    );
  }
}
