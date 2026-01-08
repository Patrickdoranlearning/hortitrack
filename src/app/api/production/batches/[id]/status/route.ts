import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getUserAndOrg } from "@/server/auth/org";
import { z } from "zod";
import { captureProtocolPerformance } from "@/server/production/protocol-performance";

const Allowed = ["Growing", "Ready", "Archived", "Sold"] as const;
const Schema = z.object({
  status: z.enum(Allowed),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = randomUUID();
  try {
    const input = Schema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    const { data: batch, error: bErr } = await supabase
      .from("batches")
      .select("id, batch_number, status")
      .eq("id", params.id)
      .eq("org_id", orgId)
      .single();
    if (bErr || !batch) return NextResponse.json({ error: "Batch not found", requestId }, { status: 404 });

    const patch: any = { status: input.status };
    if (input.status === "Archived") patch.archived_at = new Date().toISOString();

    const { error: uErr } = await supabase
      .from("batches")
      .update(patch)
      .eq("id", batch.id)
      .eq("org_id", orgId);
    if (uErr) throw uErr;

    await supabase.from("batch_events").insert({
      batch_id: batch.id,
      org_id: orgId,
      type: "STATUS_CHANGE",
      by_user_id: user.id,
      payload: { from: batch.status, to: input.status, note: input.notes ?? null },
      request_id: requestId,
    });

    // Capture protocol performance when batch reaches completion status
    if (input.status === "Ready" || input.status === "Archived") {
      // Fire and forget - don't block the response
      captureProtocolPerformance(supabase, orgId, batch.id).catch((err) => {
        console.error("[status-change] Failed to capture protocol performance:", err);
      });
    }

    return NextResponse.json({ ok: true, requestId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    const status = /Unauthenticated/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message, requestId }, { status });
  }
}
