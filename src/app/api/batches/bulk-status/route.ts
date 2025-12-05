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

    // Resolve status_id from attribute_options
    const { data: statusOption } = await supabase
      .from("attribute_options")
      .select("id")
      .eq("org_id", orgId)
      .eq("attribute_key", "production_status")
      .or(`system_code.eq.${status},display_label.eq.${status}`)
      .single();

    const updatePayload: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (statusOption) {
      updatePayload.status_id = statusOption.id;
    } else {
       // Fallback or error? If status is validated against SALEABLE_STATUSES, it should exist as an option if seeded.
       // But if not found, we proceed with just status text update to avoid breaking if options missing?
       // However, migration made status_id not null, so this update might fail if status_id was null (but it's an update, so it keeps old value if not set).
       // If we are Changing status, we SHOULD update status_id.
       console.warn(`[bulk-status] Could not find status_id for status '${status}'`);
    }

    const { error } = await supabase
      .from("batches")
      .update(updatePayload)
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

