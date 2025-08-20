export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import "server-only";
import { adminDb } from "@/server/db/admin";
import { generateNextBatchId } from "@/server/batches/nextId";
import { z } from "zod";

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
    const maybe = await req.json().catch(() => ({} as any));
    // Generate if caller didn't supply one
    const batchNumber = maybe.batchNumber ?? await generateNextBatchId({ siteCode: maybe.siteCode });
    const data = CreateBatch.parse({ ...maybe, batchNumber });

    const ref = adminDb.collection("batches").doc();
    await ref.set({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const snap = await ref.get();
    return NextResponse.json({ id: ref.id, ...snap.data() }, { status: 201 });
  } catch (err: any) {
    console.error("[/api/batches POST] failed", { err: String(err) });
    if (err?.issues) {
      return NextResponse.json({ ok: false, error: "Invalid input", issues: err.issues }, { status: 422 });
    }
    return NextResponse.json({ ok: false, error: err?.message ?? "Server error" }, { status: 500 });
  } finally {
    const ms = Date.now() - t0;
    if (ms > 1000) console.warn("[/api/batches POST] slow", { ms });
  }
}
