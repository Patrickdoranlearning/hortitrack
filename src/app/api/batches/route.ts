export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import "server-only";
import { generateNextBatchId } from "@/server/batches/nextId";
import { z } from "zod";
import { withIdempotency } from "@/server/utils/idempotency";
import { ok, fail } from "@/server/utils/envelope";
import { withApiGuard } from "@/server/http/guard";
import { getUserAndOrg } from "@/server/auth/org";

// GET - Search batches
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "25");

    const { orgId, supabase } = await getUserAndOrg();

    if (!q) {
      // No search query - return recent batches
      const { data, error } = await supabase
        .from("batches")
        .select(`
          id, 
          batch_number, 
          quantity,
          status,
          location_id,
          plant_variety:plant_varieties(id, name, family),
          location:nursery_locations(id, name)
        `)
        .eq("org_id", orgId)
        .not("status", "in", '("Archived","Shipped")')
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[api/batches GET] query error", error);
        return NextResponse.json({ data: [], error: error.message }, { status: 500 });
      }

      const items = (data || []).map((b: any) => ({
        id: b.id,
        batchNumber: b.batch_number,
        quantity: b.quantity,
        status: b.status,
        locationId: b.location_id,
        plantVariety: b.plant_variety?.name,
        variety: b.plant_variety?.name,
        family: b.plant_variety?.family,
        locationName: b.location?.name,
      }));

      return NextResponse.json({ data: items }, { status: 200 });
    }

    // Search approach: Get variety IDs that match, then search batches
    const searchTerm = `%${q}%`;

    // First search by batch number directly
    const { data: batchMatches, error: batchError } = await supabase
      .from("batches")
      .select(`
        id, 
        batch_number, 
        quantity,
        status,
        location_id,
        plant_variety:plant_varieties(id, name, family),
        location:nursery_locations(id, name)
      `)
      .eq("org_id", orgId)
      .not("status", "in", '("Archived","Shipped")')
      .ilike("batch_number", searchTerm)
      .limit(limit);

    // Also find matching varieties (filter by org_id if exists, or search all for shared varieties)
    const { data: varietyMatches } = await supabase
      .from("plant_varieties")
      .select("id")
      .or(`name.ilike.${searchTerm},family.ilike.${searchTerm}`)
      .limit(50);

    const varietyIds = (varietyMatches || []).map((v: any) => v.id);

    // Get batches with matching varieties (if any variety matches found)
    let varietyBatches: any[] = [];
    if (varietyIds.length > 0) {
      const { data: vBatches } = await supabase
        .from("batches")
        .select(`
          id, 
          batch_number, 
          quantity,
          status,
          location_id,
          plant_variety:plant_varieties(id, name, family),
          location:nursery_locations(id, name)
        `)
        .eq("org_id", orgId)
        .not("status", "in", '("Archived","Shipped")')
        .in("plant_variety_id", varietyIds)
        .limit(limit);
      
      varietyBatches = vBatches || [];
    }

    // Combine and deduplicate results
    const allBatches = [...(batchMatches || []), ...varietyBatches];
    const seen = new Set<string>();
    const uniqueBatches = allBatches.filter((b: any) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    }).slice(0, limit);

    // Transform to camelCase
    const items = uniqueBatches.map((b: any) => ({
      id: b.id,
      batchNumber: b.batch_number,
      quantity: b.quantity,
      status: b.status,
      locationId: b.location_id,
      plantVariety: b.plant_variety?.name,
      variety: b.plant_variety?.name,
      family: b.plant_variety?.family,
      locationName: b.location?.name,
    }));

    return NextResponse.json({ data: items }, { status: 200 });
  } catch (e: any) {
    console.error("[api/batches GET] 500", e);
    return NextResponse.json({ data: [], error: e?.message || "Failed to search batches" }, { status: 500 });
  }
}


// If you already have CreateBatch elsewhere, keep it. Otherwise this one is safe.
const CreateBatch = z.object({
  batchNumber: z.string().optional(),
  siteCode: z.string().optional(),
  category: z.string().optional(), // Used for logic but not inserted directly? Or maybe inserted if schema has it? Schema doesn't have category on batches.
  plantFamily: z.string().optional(),
  plantVariety: z.string().min(1),
  plantingDate: z.string().min(1),
  initialQuantity: z.number().int().nonnegative(),
  quantity: z.number().int().nonnegative(),
  status: z.string().min(1),
  location: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const POST = withApiGuard({
  method: "POST",
  bodySchema: CreateBatch,
  handler: async ({ req, body }) => {
    try {
      // Robust Auth & Org
      const { supabase, orgId } = await getUserAndOrg();
      
      const data = body;

      // Resolve IDs
      const [varietyRes, sizeRes, locationRes, supplierRes] = await Promise.all([
        supabase.from('plant_varieties').select('id').eq('name', data.plantVariety).single(),
        supabase.from('plant_sizes').select('id').eq('name', data.size ?? '').single(), // Handle null size?
        data.location ? supabase.from('nursery_locations').select('id').eq('name', data.location).eq('org_id', orgId).single() : Promise.resolve({ data: null }),
        data.supplier ? supabase.from('suppliers').select('id').eq('name', data.supplier).eq('org_id', orgId).single() : Promise.resolve({ data: null }),
      ]);

      if (!varietyRes.data) return fail(400, "INVALID_VARIETY", `Variety '${data.plantVariety}' not found`);
      if (data.size && !sizeRes.data) return fail(400, "INVALID_SIZE", `Size '${data.size}' not found`);
      if (data.location && !locationRes.data) return fail(400, "INVALID_LOCATION", `Location '${data.location}' not found`);

      const { id: batchNumber } = await generateNextBatchId({ siteCode: data.siteCode ?? "IE", when: new Date(data.plantingDate) });

      const result = await withIdempotency(req.headers.get("x-request-id"), async () => {
        const { data: newBatch, error } = await supabase
          .from("batches")
          .insert({
            org_id: orgId,
            batch_number: batchNumber,
            // category: data.category, // Removed from schema? Check schema.
            // plant_family: data.plantFamily, // Removed from schema?
            plant_variety_id: varietyRes.data!.id,
            planting_date: data.plantingDate,
            initial_quantity: data.initialQuantity,
            quantity: data.quantity,
            status: data.status,
            location_id: locationRes.data?.id,
            size_id: sizeRes.data?.id,
            supplier_id: supplierRes.data?.id,
            // notes: data.notes, // Check schema for notes
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;
        return { status: 201, body: newBatch };
      });
      return ok(result.body, result.status);

    } catch (err: any) {
      console.error("[/api/batches POST] failed", { err: String(err) });
      const msg = err?.message ?? "Server error";
      if (msg === "Unauthenticated") return fail(401, "UNAUTHORIZED", "Not authenticated");
      if (msg === "No active org selected") return fail(400, "NO_ORG", "No active organization found");
      
      // withApiGuard catches generic errors, but we can return fail() here to control the response format
      return fail(500, "SERVER_ERROR", msg);
    }
  }
});
