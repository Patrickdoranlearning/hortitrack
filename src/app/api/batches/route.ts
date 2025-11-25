export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { generateNextBatchId } from "@/server/batches/nextId";
import { z } from "zod";
import { withIdempotency } from "@/server/utils/idempotency";
import { ok, fail } from "@/server/utils/envelope";


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

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const data = CreateBatch.parse(await req.json());

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return fail(401, "UNAUTHORIZED", "Not authenticated");

    // Get active org
    let activeOrgId: string | null = null;
    const { data: profile } = await supabase.from('profiles').select('active_org_id').eq('id', user.id).single();
    if (profile?.active_org_id) {
      activeOrgId = profile.active_org_id;
    } else {
      const { data: membership } = await supabase.from('org_memberships').select('org_id').eq('user_id', user.id).limit(1).single();
      if (membership) activeOrgId = membership.org_id;
    }

    if (!activeOrgId) return fail(400, "NO_ORG", "No active organization found");

    // Resolve IDs
    const [varietyRes, sizeRes, locationRes, supplierRes] = await Promise.all([
      supabase.from('plant_varieties').select('id').eq('name', data.plantVariety).single(),
      supabase.from('plant_sizes').select('id').eq('name', data.size ?? '').single(), // Handle null size?
      data.location ? supabase.from('nursery_locations').select('id').eq('name', data.location).eq('org_id', activeOrgId).single() : Promise.resolve({ data: null }),
      data.supplier ? supabase.from('suppliers').select('id').eq('name', data.supplier).eq('org_id', activeOrgId).single() : Promise.resolve({ data: null }),
    ]);

    if (!varietyRes.data) return fail(400, "INVALID_VARIETY", `Variety '${data.plantVariety}' not found`);
    if (data.size && !sizeRes.data) return fail(400, "INVALID_SIZE", `Size '${data.size}' not found`);
    if (data.location && !locationRes.data) return fail(400, "INVALID_LOCATION", `Location '${data.location}' not found`);

    const { id: batchNumber } = await generateNextBatchId({ siteCode: data.siteCode ?? "IE", when: new Date(data.plantingDate) });

    const result = await withIdempotency(req.headers.get("x-request-id"), async () => {
      const { data: newBatch, error } = await supabase
        .from("batches")
        .insert({
          org_id: activeOrgId,
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
    if (err?.issues) return fail(422, "INVALID_INPUT", "Invalid input", err.issues);
    return fail(500, "SERVER_ERROR", err?.message ?? "Server error");
  } finally {
    const ms = Date.now() - t0;
    if (ms > 1000) console.warn("[/api/batches POST] slow", { ms });
  }
}
