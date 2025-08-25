import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/server/supabase/client";
import { PropagationStartSchema } from "@/lib/validators/batchSchemas";
import { createBatchLog } from "@/server/batches/log";

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json();
  const orgId = body.orgId as string; // provided by client from OrgContext
  if (!orgId) return NextResponse.json({ error: "orgId missing" }, { status: 400 });

  const parse = PropagationStartSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 422 });
  const input = parse.data;

  // Fetch size for tray math
  const { data: size, error: sizeErr } = await supabase
    .from("plant_sizes")
    .select("container_type,cell_multiple")
    .eq("id", input.size_id)
    .eq("org_id", orgId)
    .single();
  if (sizeErr) return NextResponse.json({ error: sizeErr.message }, { status: 400 });

  const isTray = ["prop_tray","plug_tray"].includes(size.container_type as string);
  const produced = isTray ? input.initial_tray_qty * (size.cell_multiple ?? 1) : input.initial_tray_qty;

  // Generate batch number (RPC), fallback if RPC absent
  let batchNumber = "";
  const { data: rpcNum, error: rpcErr } = await supabase.rpc("generate_batch_number", { _org_id: orgId, _date: input.planted_at.toISOString().slice(0,10) });
  batchNumber = rpcNum ?? `B-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;

  // Insert batch
  const payload = {
    org_id: orgId,
    batch_number: batchNumber,
    phase: "propagation",
    status: "Growing",
    plant_variety_id: input.plant_variety_id,
    size_id: input.size_id,
    location_id: input.location_id,
    supplier_id: input.supplier_id ?? null,
    planted_at: input.planted_at.toISOString().slice(0,10),
    initial_quantity: input.initial_tray_qty,
    quantity: produced,
    unit: "plants",
  };
  const { data: batch, error } = await supabase.from("batches").insert(payload).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await createBatchLog({ orgId, batchId: batch.id, type: "propagation_start", note: "Propagation started", qty_change: produced });

  return NextResponse.json({ id: batch.id, batch_number: batchNumber, quantity: produced });
}
