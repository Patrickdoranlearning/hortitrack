import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getUserAndOrg } from "@/server/auth/org";
import { z } from "zod";

const Schema = z.object({
  units: z.number().int().positive(),
  reason: z.string().min(2).max(200),
  archive_if_empty: z.boolean().optional().default(true),
  notes: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = randomUUID();
  try {
    const input = Schema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    // Verify batch & get current qty
    const { data: batch, error: bErr } = await supabase
      .from("batches")
      .select("id, org_id, batch_number, quantity")
      .eq("id", id).eq("org_id", orgId).single();
    if (bErr || !batch) return NextResponse.json({ error: "Batch not found", requestId }, { status: 404 });

    // Atomic decrement (fails if insufficient)
    const { data: newQty, error: dErr } = await supabase.rpc("decrement_batch_quantity", {
      p_org_id: orgId, p_batch_id: batch.id, p_units: input.units
    });
    if (dErr) return NextResponse.json({ error: dErr.message, requestId }, { status: 409 });

    // Event
    await supabase.from("batch_events").insert({
      batch_id: batch.id,
      org_id: orgId,
      type: "DUMP",
      by_user_id: user.id,
      payload: {
        reason: input.reason,
        units: input.units,
        new_quantity: newQty,
        note: input.notes ?? null,
      },
      request_id: requestId,
    });

    // Optional archive if zero
    if ((newQty as number) === 0 && (input.archive_if_empty ?? true)) {
      await supabase.from("batches")
        .update({ status: "Archived", archived_at: new Date().toISOString() })
        .eq("id", batch.id)
        .eq("org_id", orgId);
      await supabase.from("batch_events").insert({
        batch_id: batch.id,
        org_id: orgId,
        type: "ARCHIVE",
        by_user_id: user.id,
        payload: { reason: "Zero quantity after dump" },
        request_id: requestId,
      });
    }

    return NextResponse.json({ ok: true, new_quantity: newQty, requestId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    const status = /Unauthenticated/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message, requestId }, { status });
  }
}
