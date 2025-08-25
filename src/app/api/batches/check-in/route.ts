import { NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase/client";
import { BatchCheckInSchema } from "@/lib/validators/batchSchemas";
import { createBatchLog } from "@/server/batches/log";

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json();
  const orgId = body.orgId as string;
  if (!orgId) return NextResponse.json({ error: "orgId missing" }, { status: 400 });

  const parsed = BatchCheckInSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const input = parsed.data;

  // Size for tray math
  const { data: size, error: sizeErr } = await supabase
    .from("plant_sizes")
    .select("container_type,cell_multiple")
    .eq("id", input.size_id)
    .eq("org_id", orgId)
    .single();
  if (sizeErr) return NextResponse.json({ error: sizeErr.message }, { status: 400 });

  const isTray = ["prop_tray","plug_tray"].includes(size.container_type as string);
  const produced = isTray ? input.tray_qty * (size.cell_multiple ?? 1) : input.tray_qty;

  // Batch number
  const { data: rpcNum } = await supabase.rpc("generate_batch_number", { _org_id: orgId, _date: input.check_in_date.toISOString().slice(0,10) });
  const batchNumber = rpcNum ?? `B-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;

  const payload = {
    org_id: orgId,
    batch_number: batchNumber,
    phase: input.phase,
    status: input.status,
    plant_variety_id: input.plant_variety_id,
    size_id: input.size_id,
    location_id: input.location_id,
    supplier_id: input.supplier_id ?? null,
    planted_at: input.check_in_date.toISOString().slice(0,10), // treat as arrival/plant date
    initial_quantity: input.tray_qty,
    quantity: produced,
    passport_override_a: input.passport_a ?? null,
    passport_override_b: input.passport_b ?? null,
    passport_override_c: input.passport_c ?? null,
    passport_override_d: input.passport_d ?? null,
    unit: "plants",
  };

  // Uniqueness: prevent duplicate number per org
  const { data: dupe } = await supabase.from("batches").select("id").eq("org_id", orgId).eq("batch_number", batchNumber).maybeSingle();
  if (dupe) return NextResponse.json({ error: "Duplicate batch number", existing_batch_id: dupe.id }, { status: 409 });

  const { data: batch, error } = await supabase.from("batches").insert(payload).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await createBatchLog({ orgId, batchId: batch.id, type: "check_in", note: input.note, qty_change: produced });

  // If phase change semantics needed later, add another log here.

  return NextResponse.json({ id: batch.id, batch_number: batchNumber, quantity: produced });
}
