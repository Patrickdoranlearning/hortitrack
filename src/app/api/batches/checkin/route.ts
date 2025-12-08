import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Structured payload (legacy)
const StructuredSchema = z.object({
  orgId: z.string().uuid(),
  varietyId: z.string().uuid(),
  sizeId: z.string().uuid(),
  locationId: z.string().uuid(),
  phase: z.enum(["propagation", "plug_linear", "potted"]).default("potted"),
  containers: z.number().int().positive(),
  supplierId: z.string().uuid().nullable().optional(),
  supplierBatchNumber: z.string().optional(), // relax; DB can enforce
  incomingDate: z.string().optional(), // ISO
  photos: z.array(z.string().url()).max(3).optional(),
  quality: z
    .object({
      rating: z.number().int().min(0).max(6).optional(),
      pest_notes: z.string().optional(),
      disease_notes: z.string().optional(),
    })
    .optional(),
  passportOverrides: z
    .object({
      a_family: z.string().optional(),
      b_producer_code: z.string().optional(),
      c_batch_number: z.string().optional(),
      d_country_code: z.string().optional(),
    })
    .optional(),
});

// Flat payload (this form)
const FlatSchema = z.object({
  orgId: z.string().uuid(),
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  supplier_id: z.string().uuid().nullable().optional(),
  quantity: z.coerce.number().int().min(0),
  quality_rating: z.coerce.number().int().min(0).max(6).optional().default(0),
  pest_notes: z.string().optional(),
  disease_notes: z.string().optional(),
  passport_override_a: z.string().optional(),
  passport_override_b: z.string().optional(),
  passport_override_c: z.string().optional(), // supplier batch number
  passport_override_d: z.string().optional(),
  incoming_date: z.string().optional(), // ISO
  photos: z.array(z.string().url()).max(3).optional(),
});

type Normalized = {
  orgId: string;
  varietyId: string;
  sizeId: string;
  locationId: string;
  phase: "propagation" | "plug_linear" | "potted";
  containers: number;
  supplierId: string | null;
  supplierBatchNumber: string;
  incomingDate: string; // ISO date
  photos: string[];
  quality: { rating?: number; pest_notes?: string; disease_notes?: string };
  passportOverrides: {
    a_family?: string;
    b_producer_code?: string;
    c_batch_number?: string;
    d_country_code?: string;
  };
};

function normalizeStructured(p: z.infer<typeof StructuredSchema>): Normalized {
  return {
    orgId: p.orgId,
    varietyId: p.varietyId,
    sizeId: p.sizeId,
    locationId: p.locationId,
    phase: p.phase ?? "potted",
    containers: p.containers,
    supplierId: p.supplierId ?? null,
    supplierBatchNumber: p.supplierBatchNumber ?? "N/A",
    incomingDate: p.incomingDate ?? new Date().toISOString(),
    photos: p.photos ?? [],
    quality: p.quality ?? {},
    passportOverrides: p.passportOverrides ?? {},
  };
}

function normalizeFlat(p: z.infer<typeof FlatSchema>): Normalized {
  return {
    orgId: p.orgId,
    varietyId: p.plant_variety_id,
    sizeId: p.size_id,
    locationId: p.location_id,
    phase: "potted",
    containers: p.quantity,
    supplierId: p.supplier_id ?? null,
    supplierBatchNumber: p.passport_override_c ?? "N/A",
    incomingDate: p.incoming_date ?? new Date().toISOString(),
    photos: p.photos ?? [],
    quality: {
      rating: p.quality_rating,
      pest_notes: p.pest_notes,
      disease_notes: p.disease_notes,
    },
    passportOverrides: {
      a_family: p.passport_override_a || undefined,
      b_producer_code: p.passport_override_b || undefined,
      c_batch_number: p.passport_override_c || undefined,
      d_country_code: p.passport_override_d || undefined,
    },
  };
}

export async function POST(req: Request) {
  const supabase = await createClient();

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let normalized: Normalized | null = null;
  const s = StructuredSchema.safeParse(body);
  if (s.success) {
    normalized = normalizeStructured(s.data);
  } else {
    const f = FlatSchema.safeParse(body);
    if (f.success) normalized = normalizeFlat(f.data);
  }
  if (!normalized) {
    return NextResponse.json(
      { error: "Invalid payload", issues: s.error?.flatten?.() ?? undefined },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("fn_checkin_batch", {
    p_org_id: normalized.orgId,
    p_variety_id: normalized.varietyId,
    p_size_id: normalized.sizeId,
    p_location_id: normalized.locationId,
    p_phase: normalized.phase,
    p_containers: normalized.containers,
    p_supplier_id: normalized.supplierId,
    p_supplier_batch_number: normalized.supplierBatchNumber,
    p_incoming_date: normalized.incomingDate,
    p_photos: normalized.photos,
    p_quality: normalized.quality,
    p_passport_overrides: normalized.passportOverrides,
  });

  if (error) {
    console.error("[checkin] rpc error", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ batch: data?.[0] ?? null });
}
