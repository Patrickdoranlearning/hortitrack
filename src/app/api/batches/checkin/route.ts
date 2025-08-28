import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr"; // Use createServerClient from @supabase/ssr
import { cookies, headers } from "next/headers";

const schema = z.object({
  orgId: z.string().uuid(),
  varietyId: z.string().uuid(),
  sizeId: z.string().uuid(),
  locationId: z.string().uuid(),
  phase: z.enum(["propagation", "plug_linear", "potted"]), // Ensure these enum values match your DB type
  containers: z.number().int().positive(),
  supplierId: z.string().uuid().nullable(),
  supplierBatchNumber: z.string().min(1),
  incomingDate: z.string().date().or(z.string()), // allow ISO
  photos: z.array(z.string().url()).max(3).optional(),
  quality: z.object({
    pests: z.boolean().optional(),
    disease: z.boolean().optional(),
    stars: z.number().int().min(1).max(6).optional(),
    notes: z.string().optional(),
  }).optional(),
  passportOverrides: z.object({
    family: z.string().optional(),
    producer_code: z.string().optional(),
    country_code: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (key) => cookies().get(key)?.value, set: () => {}, remove: () => {} }, headers }
  ); // Directly use createServerClient with headers
  
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  // Call Postgres function
  const { data, error } = await supabase.rpc("fn_checkin_batch", {
    p_org_id: p.orgId,
    p_variety_id: p.varietyId,
    p_size_id: p.sizeId,
    p_location_id: p.locationId,
    p_phase: p.phase,
    p_containers: p.containers,
    p_supplier_id: p.supplierId,
    p_supplier_batch_number: p.supplierBatchNumber,
    p_incoming_date: p.incomingDate,
    p_photos: p.photos ?? [],
    p_quality: p.quality ?? {},
    p_passport_overrides: p.passportOverrides ?? {},
  });

  if (error) {
    console.error("checkin error", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ batch: data?.[0] ?? null });
}
