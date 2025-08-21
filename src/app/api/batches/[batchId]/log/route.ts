import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import { ok, fail } from "@/server/utils/envelope";
import { withIdempotency } from "@/server/utils/idempotency";
import { FieldValue } from "firebase-admin/firestore";

const LogCreate = z.object({
  action: z.string().min(1),      // e.g., "Move" | "Dump" | "Note"
  notes: z.string().optional(),
  photoId: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { batchId: string } }) {
  const ref = adminDb.collection("batches").doc(params.batchId);
  const snap = await ref.get();
  if (!snap.exists) return fail(404, "NOT_FOUND", "Batch not found");
  const logs = Array.isArray(snap.data()?.logHistory) ? snap.data()!.logHistory.slice(-100) : [];
  return ok({ logs }, 200);
}

export async function POST(req: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const payload = LogCreate.parse(await req.json());
    const ref = adminDb.collection("batches").doc(params.batchId);
    const exist = await ref.get();
    if (!exist.exists) return fail(404, "NOT_FOUND", "Batch not found");

    const result = await withIdempotency(req.headers.get("x-request-id"), async () => {
      await ref.update({
        logHistory: FieldValue.arrayUnion({
          ...payload,
          date: new Date().toISOString(),
        }),
        updatedAt: new Date().toISOString(),
      });
      return { status: 201, body: { ok: true } };
    });
    return ok(result.body, result.status);
  } catch (e:any) {
    if (e?.issues) return fail(422, "INVALID_INPUT", "Invalid input", e.issues);
    return fail(500, "SERVER_ERROR", e?.message ?? "Server error");
  }
}
