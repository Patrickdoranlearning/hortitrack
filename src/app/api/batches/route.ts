export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import "server-only";
import { adminDb } from "@/server/db/admin";
import { generateNextBatchId } from "@/server/batches/nextId";
import { z } from "zod";
import { withIdempotency } from "@/server/utils/idempotency";
import { ok, fail } from "@/server/utils/envelope";


// If you already have CreateBatch elsewhere, keep it. Otherwise this one is safe.
const CreateBatch = z.object({
  batchNumber: z.string().optional(),
  siteCode: z.string().optional(),   // used only for ID format if batchNumber not provided
  category: z.string().min(1),
  plantFamily: z.string().min(1),
  plantVariety: z.string().min(1),
  plantingDate: z.string().min(1), // ISO date
  initialQuantity: z.number().int().nonnegative(),
  quantity: z.number().int().nonnegative(),
  status: z.string().min(1),
  location: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const data = CreateBatch.parse(await req.json());
    const id = data.batchNumber || (await generateNextBatchId({ siteCode: data.siteCode ?? "IE" })).id;
    const ref = adminDb.collection("batches").doc();
    const result = await withIdempotency(req.headers.get("x-request-id"), async () => {
      await ref.set({ ...data, batchNumber: id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const snap = await ref.get();
      return { status: 201, body: { id: ref.id, ...snap.data() } };
    });
    return ok(result.body, result.status);
  } catch (err: any) {
    console.error("[/api/batches POST] failed", { err: String(err) });
    if (err?.issues) return fail(422, "INVALID_INPUT", "Invalid input", err.issues);
    return fail(500, "SERVER_ERROR", err?.message ?? "Server error");
  } finally {
    const ms = Date.now() - t0;
    if (ms > 1000) console.warn("[/api/batches POST] slow", { ms });
  }
}
