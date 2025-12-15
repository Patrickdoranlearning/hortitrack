import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getUserAndOrg } from "@/server/auth/org";
import { z } from "zod";

const Schema = z.object({
  location_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = randomUUID();
  try {
    const input = Schema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    // Ensure batch belongs to org
    const { data: batch, error: bErr } = await supabase
      .from("batches")
      .select("id, batch_number, location_id")
      .eq("id", params.id)
      .eq("org_id", orgId)
      .single();
    if (bErr || !batch) return NextResponse.json({ error: "Batch not found", requestId }, { status: 404 });

    // Update location
    const { error: uErr } = await supabase
      .from("batches")
      .update({ location_id: input.location_id })
      .eq("id", batch.id)
      .eq("org_id", orgId);
    if (uErr) throw uErr;

    // Event
    await supabase.from("batch_events").insert({
      batch_id: batch.id,
      org_id: orgId,
      type: "MOVE",
      by_user_id: user.id,
      payload: {
        from_location_id: batch.location_id,
        to_location_id: input.location_id,
        note: input.notes ?? null,
      },
      request_id: requestId,
    });

    return NextResponse.json({ ok: true, requestId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    const status = /Unauthenticated/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message, requestId }, { status });
  }
}
