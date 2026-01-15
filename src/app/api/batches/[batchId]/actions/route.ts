export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserAndOrg } from "@/server/auth/org";
import { nextBatchNumber } from "@/server/numbering/batches";

const Input = z.object({
  type: z.enum(["MOVE", "DUMP", "CHECKIN", "NOTE"]),
  at: z.string().datetime(),
  toLocationId: z.string().optional(),
  toLocation: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  flags: z.array(z.string()).optional(),
  photos: z
    .array(
      z.object({
        url: z.string().url(),
        path: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
    )
    .optional(),
});

type PhotoPayload = NonNullable<z.infer<typeof Input>["photos"]>[number];

const PHASE_COUNTER: Record<string, 1 | 2 | 3> = {
  propagation: 1,
  propagating: 1,
  plug: 2,
  growing: 2,
  liners: 2,
  finished: 3,
  potted: 3,
};

const BATCH_FIELDS = [
  "id",
  "org_id",
  "batch_number",
  "quantity",
  "initial_quantity",
  "phase",
  "status",
  "status_id",
  "plant_variety_id",
  "size_id",
  "location_id",
  "supplier_id",
  "planted_at",
  "unit",
].join(",");

type BatchRow = {
  id: string;
  org_id: string;
  batch_number: string | null;
  quantity: number | null;
  initial_quantity: number | null;
  phase: string | null;
  status: string | null;
  status_id: string | null;
  plant_variety_id: string | null;
  size_id: string | null;
  location_id: string | null;
  supplier_id: string | null;
  planted_at?: string | null;
  unit?: string | null;
};

function corsHeaders() {
  const allow =
    process.env.NODE_ENV === "development"
      ? "*"
      : process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type,idempotency-key",
    "access-control-allow-credentials": "true",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const requestId = req.headers.get("idempotency-key") ?? randomUUID();

  try {
    const { batchId } = await params;
    const raw = await req.json();
    const parsed = Input.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
            code: issue.code,
          })),
        },
        { status: 400, headers: corsHeaders() }
      );
    }
    const input = parsed.data;
    const { supabase, orgId, user } = await getUserAndOrg();

    const batch = await loadBatch(supabase, orgId, batchId);
    if (!batch) {
      return NextResponse.json(
        { error: "batch not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    const now = new Date(input.at);
    let result: HandlerResult;

    switch (input.type) {
      case "MOVE":
        result = await handleMove({
          supabase,
          orgId,
          userId: user.id,
          batch,
          input,
          requestId,
          occurredAt: now,
        });
        break;
      case "DUMP":
        result = await handleDump({
          supabase,
          orgId,
          userId: user.id,
          batch,
          input,
          requestId,
          occurredAt: now,
        });
        break;
      case "CHECKIN":
        result = await handleCheckOrNote({
          supabase,
          orgId,
          userId: user.id,
          batch,
          input,
          requestId,
          occurredAt: now,
          updateStatus: true,
        });
        break;
      case "NOTE":
        result = await handleCheckOrNote({
          supabase,
          orgId,
          userId: user.id,
          batch,
          input,
          requestId,
          occurredAt: now,
          updateStatus: false,
        });
        break;
      default:
        throw new Error(`Unsupported action ${input.type}`);
    }

    const response = {
      ok: true,
      actionId: requestId,
      type: input.type,
      appliedDelta: result.appliedDelta,
      batch: {
        id: batch.id,
        quantityAfter: result.quantityAfter,
      },
      splitBatchId: result.splitBatchId ?? null,
      splitBatchNumber: result.splitBatchNumber ?? null,
    };

    return NextResponse.json(response, { status: 201, headers: corsHeaders() });
  } catch (error: any) {
    const msg = String(error?.message || error);
    const status = /not found/i.test(msg)
      ? 404
      : /required|quantity|destination|invalid|photo/i.test(msg)
      ? 400
      : 500;
    return NextResponse.json({ error: msg }, { status, headers: corsHeaders() });
  }
}

type HandlerArgs = {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  batch: BatchRow;
  input: z.infer<typeof Input>;
  requestId: string;
  occurredAt: Date;
};

type HandlerResult = {
  appliedDelta: number;
  quantityAfter: number;
  splitBatchId?: string | null;
  splitBatchNumber?: string | null;
};

async function handleMove(ctx: HandlerArgs): Promise<HandlerResult> {
  const { supabase, orgId, userId, batch, input, requestId, occurredAt } = ctx;
  const destination = await resolveLocation(
    supabase,
    orgId,
    input.toLocationId,
    input.toLocation
  );

  const currentQty = Number(batch.quantity ?? 0);
  if (currentQty <= 0) {
    throw new Error("Batch has no remaining quantity to move");
  }

  const qty = Math.min(input.quantity ?? currentQty, currentQty);
  if (qty <= 0) {
    throw new Error("quantity must be greater than zero");
  }
  const partial = qty < currentQty;

  const notes = normalizeText(input.notes);
  const photos = normalizePhotos(input.photos);

  let splitBatchId: string | null = null;
  let splitBatchNumber: string | null = null;
  let quantityAfter = currentQty;
  let appliedDelta = 0;

  if (partial) {
    const { data: remainingQty, error } = await supabase.rpc(
      "decrement_batch_quantity",
      {
        p_org_id: orgId,
        p_batch_id: batch.id,
        p_units: qty,
      }
    );
    if (error) throw new Error(error.message);

    quantityAfter = Number(remainingQty ?? 0);
    appliedDelta = -qty;

    const phaseCounter = mapPhaseToCounter(batch.phase);
    const newBatchNumber = await nextBatchNumber(phaseCounter);

    const { data: child, error: childErr } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: newBatchNumber,
        phase: batch.phase ?? "growing",
        plant_variety_id: batch.plant_variety_id,
        size_id: batch.size_id,
        location_id: destination.id,
        status: batch.status ?? "Growing",
        status_id: batch.status_id, // Inherit
        quantity: qty,
        initial_quantity: qty,
        unit: batch.unit ?? "plants",
        planted_at: batch.planted_at ?? null,
        supplier_id: batch.supplier_id,
        parent_batch_id: batch.id,
      })
      .select("id, batch_number")
      .single();

    if (childErr || !child) {
      await supabase.rpc("decrement_batch_quantity", {
        p_org_id: orgId,
        p_batch_id: batch.id,
        p_units: -qty,
      });
      throw new Error(childErr?.message ?? "Failed to create split batch");
    }

    splitBatchId = child.id;
    splitBatchNumber = child.batch_number;

    const totalBefore = currentQty;
    const proportion =
      totalBefore > 0 ? Number((qty / totalBefore).toFixed(4)) : 1;

    await supabase.from("batch_ancestry").insert({
      org_id: orgId,
      parent_batch_id: batch.id,
      child_batch_id: child.id,
      proportion,
    });

    await insertEvent(supabase, {
      batch_id: child.id,
      org_id: orgId,
      type: "MOVE_IN",
      by_user_id: userId,
      at: occurredAt,
      payload: {
        from_batch_id: batch.id,
        from_batch_number: batch.batch_number,
        units_received: qty,
        location_id: destination.id,
        location_name: destination.name ?? null,
        notes,
        photos,
      },
    });
  } else {
    const { error: updateErr } = await supabase
      .from("batches")
      .update({
        location_id: destination.id,
        updated_at: occurredAt.toISOString(),
      })
      .eq("id", batch.id)
      .eq("org_id", orgId);
    if (updateErr) throw new Error(updateErr.message);
  }

  await insertEvent(supabase, {
    batch_id: batch.id,
    org_id: orgId,
    type: "MOVE",
    by_user_id: userId,
    at: occurredAt,
    payload: {
      units_moved: qty,
      partial,
      to_location_id: destination.id,
      to_location_name: destination.name ?? null,
      notes,
      photos,
      split_batch_id: splitBatchId,
      split_batch_number: splitBatchNumber,
    },
  });

  return {
    appliedDelta,
    quantityAfter,
    splitBatchId,
    splitBatchNumber,
  };
}

async function handleDump(ctx: HandlerArgs): Promise<HandlerResult> {
  const { supabase, orgId, userId, batch, input, requestId, occurredAt } = ctx;
  const currentQty = Number(batch.quantity ?? 0);
  if (currentQty <= 0) throw new Error("Batch has no quantity to dump");

  if (!input.reason || !input.reason.trim()) {
    throw new Error("reason is required for DUMP");
  }

  const qty = Math.min(input.quantity ?? currentQty, currentQty);
  if (qty <= 0) throw new Error("quantity must be greater than zero");

  const { data: remainingQty, error } = await supabase.rpc(
    "decrement_batch_quantity",
    {
      p_org_id: orgId,
      p_batch_id: batch.id,
      p_units: qty,
    }
  );
  if (error) throw new Error(error.message);

  const quantityAfter = Number(remainingQty ?? 0);
  const shouldArchive = quantityAfter === 0;

  const updatePayload: any = {
      quantity: quantityAfter,
      status: shouldArchive ? "Archived" : batch.status,
      archived_at: shouldArchive ? occurredAt.toISOString() : null,
      updated_at: occurredAt.toISOString(),
  };

  if (shouldArchive) {
     // Resolve 'Archived' status_id
     const { data: sOpt } = await supabase
      .from("attribute_options")
      .select("id")
      .eq("org_id", orgId)
      .eq("attribute_key", "production_status")
      .or(`system_code.eq.Archived,display_label.eq.Archived`)
      .single();
     if (sOpt) updatePayload.status_id = sOpt.id;
  }

  const { error: updateErr } = await supabase
    .from("batches")
    .update(updatePayload)
    .eq("id", batch.id)
    .eq("org_id", orgId);
  if (updateErr) throw new Error(updateErr.message);

  await insertEvent(supabase, {
    batch_id: batch.id,
    org_id: orgId,
    type: "DUMP",
    by_user_id: userId,
    at: occurredAt,
    payload: {
      units: qty,
      units_dumped: qty,  // Keep for backwards compatibility
      reason: input.reason,
      notes: normalizeText(input.notes),
    },
  });

  return {
    appliedDelta: -qty,
    quantityAfter,
  };
}

async function handleCheckOrNote(
  ctx: HandlerArgs & { updateStatus: boolean }
): Promise<HandlerResult> {
  const {
    supabase,
    orgId,
    userId,
    batch,
    input,
    requestId,
    occurredAt,
    updateStatus,
  } = ctx;

  const updates: Record<string, any> = {
    updated_at: occurredAt.toISOString(),
  };
  if (updateStatus && input.status) {
    updates.status = input.status;

    // Resolve status_id
    const { data: sOpt } = await supabase
      .from("attribute_options")
      .select("id")
      .eq("org_id", orgId)
      .eq("attribute_key", "production_status")
      .or(`system_code.eq.${input.status},display_label.eq.${input.status}`)
      .single();
    if (sOpt) updates.status_id = sOpt.id;
  }

  const { error: updateErr } = await supabase
    .from("batches")
    .update(updates)
    .eq("id", batch.id)
    .eq("org_id", orgId);
  if (updateErr) throw new Error(updateErr.message);

  await insertEvent(supabase, {
    batch_id: batch.id,
    org_id: orgId,
    type: input.type,
    by_user_id: userId,
    at: occurredAt,
    payload: {
      notes: normalizeText(input.notes),
      status: updateStatus ? input.status ?? null : null,
      flags: input.flags ?? [],
      photos: normalizePhotos(input.photos),
    },
  });

  return {
    appliedDelta: 0,
    quantityAfter: Number(batch.quantity ?? 0),
  };
}

async function loadBatch(
  supabase: SupabaseClient,
  orgId: string,
  identifier: string
): Promise<BatchRow | null> {
  if (looksLikeUuid(identifier)) {
    const byId = await supabase
      .from("batches")
      .select(BATCH_FIELDS)
      .eq("org_id", orgId)
      .eq("id", identifier)
      .maybeSingle();
    if (byId.data) return byId.data as unknown as BatchRow;
    if (byId.error && byId.error.code !== "PGRST116") {
      throw new Error(byId.error.message);
    }
  }

  const byNumber = await supabase
    .from("batches")
    .select(BATCH_FIELDS)
    .eq("org_id", orgId)
    .eq("batch_number", identifier)
    .maybeSingle();

  if (byNumber.error && byNumber.error.code !== "PGRST116") {
    throw new Error(byNumber.error.message);
  }

  return (byNumber.data as unknown as BatchRow) ?? null;
}

async function resolveLocation(
  supabase: SupabaseClient,
  orgId: string,
  locationId?: string | null,
  fallbackName?: string | null
) {
  if (locationId && looksLikeUuid(locationId)) {
    const { data, error } = await supabase
      .from("nursery_locations")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("id", locationId)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }
    if (data) return data;
  }

  const searchName = fallbackName ?? locationId;
  if (searchName) {
    const { data, error } = await supabase
      .from("nursery_locations")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("name", searchName)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }
    if (data) return data;
  }

  throw new Error("Destination location not found");
}

async function insertEvent(
  supabase: SupabaseClient,
  data: {
    batch_id: string;
    org_id: string;
    type: string;
    by_user_id: string;
    at: Date;
    payload: Record<string, any>;
  }
) {
  const { error } = await supabase.from("batch_events").insert({
    batch_id: data.batch_id,
    org_id: data.org_id,
    type: data.type,
    by_user_id: data.by_user_id,
    at: data.at.toISOString(),
    payload: JSON.stringify(data.payload),
  });
  if (error) throw new Error(error.message);
}

function normalizeText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePhotos(list?: PhotoPayload[] | null) {
  return (list ?? []).map((photo) => ({
    url: photo.url,
    path: photo.path ?? null,
    width: photo.width ?? null,
    height: photo.height ?? null,
  }));
}

function looksLikeUuid(value: string) {
  return /^[0-9a-fA-F-]{32,36}$/.test(value);
}

function mapPhaseToCounter(phase?: string | null): 1 | 2 | 3 {
  if (!phase) return 2;
  const normalized = phase.toLowerCase();
  return PHASE_COUNTER[normalized] ?? 2;
}
