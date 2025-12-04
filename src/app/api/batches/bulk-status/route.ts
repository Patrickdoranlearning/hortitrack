import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { SALEABLE_STATUSES } from "@/server/production/saleable";

const bulkSchema = z.object({
  batchIds: z.array(z.string().uuid()).min(1, "Select at least one batch."),
  status: z.string(),
  note: z.string().max(500).optional(),
  flags: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const payload = bulkSchema.parse(json);
    const status = payload.status.trim();

    if (!SALEABLE_STATUSES.includes(status as (typeof SALEABLE_STATUSES)[number])) {
      return NextResponse.json(
        { error: "Status must be Ready or Looking Good." },
        { status: 400 }
      );
    }

    const { orgId, supabase, user } = await getUserAndOrg();

    const { error } = await supabase
      .from("batches")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .in("id", payload.batchIds)
      .eq("org_id", orgId);

    if (error) {
      console.error("[bulk-status] update failed", error);
      return NextResponse.json({ error: "Failed to update batches." }, { status: 500 });
    }

    const metadata = {
      mode: "bulk",
      status,
      note: payload.note ?? null,
      flags: payload.flags ?? [],
    };

    const events = payload.batchIds.map((batchId) => ({
      batch_id: batchId,
      org_id: orgId,
      type: "STATUS_CHANGE",
      at: new Date().toISOString(),
      by_user_id: user.id,
      payload: JSON.stringify(metadata),
    }));

    const { error: eventError } = await supabase.from("batch_events").insert(events);
    if (eventError) {
      console.warn("[bulk-status] events insert failed", eventError);
    }

    return NextResponse.json({
      ok: true,
      updated: payload.batchIds.length,
    });
  } catch (error) {
    console.error("[bulk-status] unexpected", error);
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}

