export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import "server-only";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import { generateNextBatchId } from "@/server/batches/nextId";

const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("MOVE"),
    batchNumber: z.string().min(1),
    locationId: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal("DUMPED"),
    batchNumber: z.string().min(1),
    quantity: z.number().int().positive(),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("TRANSPLANT"),
    sourceBatchNumber: z.string().min(1),
    quantity: z.number().int().positive(),
    target: z.object({
      locationId: z.string().nullable().optional(),
      size: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  }),
]);

async function getBatchByNumber(batchNumber: string) {
  const snap = await adminDb.collection("batches")
    .where("batchNumber", "==", batchNumber)
    .limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as any) };
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const body = await req.json();
    const input = ActionSchema.parse(body);
    console.log("[/api/actions] input", input);

    if (input.type === "MOVE") {
      const b = await getBatchByNumber(input.batchNumber);
      if (!b) return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });
      await adminDb.collection("batches").doc(b.id).update({
        locationId: input.locationId ?? null,
        location: input.location ?? null,
        updatedAt: new Date().toISOString(),
      });
      console.log("[/api/actions] MOVE updated", b.id);
      return NextResponse.json({ ok: true });
    }

    if (input.type === "DUMPED") {
      const b = await getBatchByNumber(input.batchNumber);
      if (!b) return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });
      const newQty = Math.max(0, Number(b.quantity ?? 0) - input.quantity);
      await adminDb.collection("batches").doc(b.id).update({
        quantity: newQty,
        updatedAt: new Date().toISOString(),
      });
      await adminDb.collection("actions_log").add({
        type: "DUMPED",
        batchNumber: input.batchNumber,
        quantity: input.quantity,
        reason: input.reason,
        createdAt: new Date().toISOString(),
      });
      console.log("[/api/actions] DUMPED updated", { id: b.id, newQty });
      return NextResponse.json({ ok: true, quantity: newQty });
    }

    if (input.type === "TRANSPLANT") {
      const src = await getBatchByNumber(input.sourceBatchNumber);
      if (!src) return NextResponse.json({ ok: false, error: "Source batch not found" }, { status: 404 });

      const newSrcQty = Math.max(0, Number(src.quantity ?? 0) - input.quantity);
      const childBatchNumber = await generateNextBatchId({ siteCode: String(src.siteCode ?? "1") });

      const batchRef = adminDb.collection("batches").doc();
      const srcRef = adminDb.collection("batches").doc(src.id);

      await adminDb.runTransaction(async (tx) => {
        tx.update(srcRef, { quantity: newSrcQty, updatedAt: new Date().toISOString() });
        tx.set(batchRef, {
          batchNumber: childBatchNumber,
          category: src.category,
          plantFamily: src.plantFamily,
          plantVariety: src.plantVariety,
          plantingDate: new Date().toISOString(),
          initialQuantity: input.quantity,
          quantity: input.quantity,
          status: "Propagation",
          locationId: input.target.locationId ?? null,
          size: input.target.size ?? null,
          notes: input.target.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          parentBatchNumber: src.batchNumber,
        });
      });

      console.log("[/api/actions] TRANSPLANT created", { childBatchNumber, newSrcQty });
      return NextResponse.json({ ok: true, childBatchNumber, sourceQuantity: newSrcQty });
    }

    return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    if (err?.issues) {
      console.warn("[/api/actions] 422", err.issues);
      return NextResponse.json({ ok: false, error: "Invalid input", issues: err.issues }, { status: 422 });
    }
    console.error("[/api/actions] 500", String(err));
    return NextResponse.json({ ok: false, error: err?.message ?? "Server error" }, { status: 500 });
  } finally {
    const ms = Date.now() - t0;
    if (ms > 1000) console.warn("[/api/actions] slow", { ms });
  }
}
