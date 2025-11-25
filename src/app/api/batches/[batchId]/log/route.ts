import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/server/utils/envelope";
import { withIdempotency } from "@/server/utils/idempotency";

const LogCreate = z.object({
  action: z.string().min(1),      // e.g., "Move" | "Dump" | "Note"
  notes: z.string().optional(),
  photoId: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { batchId: string } }) {
  const supabase = await createClient();
  const { data: logs, error } = await supabase
    .from("logs")
    .select("*")
    .eq("batch_id", params.batchId)
    .order("date", { ascending: false })
    .limit(100);

  if (error) return fail(500, "DB_ERROR", error.message);
  return ok({ logs }, 200);
}

export async function POST(req: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const payload = LogCreate.parse(await req.json());
    const result = await withIdempotency(req.headers.get("x-request-id"), async () => {
      const supabase = await createClient();

      // Verify batch exists
      const { data: batch, error: batchError } = await supabase
        .from("batches")
        .select("id")
        .eq("id", params.batchId)
        .single();

      if (batchError || !batch) return { status: 404, body: { ok: false, error: "Batch not found" } };

      // Insert log
      const { error: insertError } = await supabase.from("logs").insert({
        batch_id: params.batchId,
        action: payload.action,
        note: payload.notes,
        photo_id: payload.photoId,
        date: new Date().toISOString(),
        // user_id: ... (would need to get user from auth)
      });

      if (insertError) throw insertError;

      // Update batch updatedAt
      await supabase.from("batches").update({ updated_at: new Date().toISOString() }).eq("id", params.batchId);

      return { status: 201, body: { ok: true } };
    });
    return ok(result.body, result.status);
  } catch (e: any) {
    if (e?.issues) return fail(422, "INVALID_INPUT", "Invalid input", e.issues);
    return fail(500, "SERVER_ERROR", e?.message ?? "Server error");
  }
}
