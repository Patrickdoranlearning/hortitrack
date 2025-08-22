
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import { generateNextBatchId } from "@/server/batches/nextId";
import { switchPassportToInternal } from "@/server/batches/service";

const Input = z.object({
  plantingDate: z.string().datetime(),
  quantity: z.number().int().positive(),
  size: z.string().min(1),
  // Either locationId OR location (name) may be provided
  locationId: z.string().optional(),
  location: z.string().optional(),
  logRemainingAsLoss: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

function corsHeaders() {
  // In dev, allow any origin (Cloud Workstations, localhost)
  const allow =
    process.env.NODE_ENV === "development" ? "*" : undefined;
  return {
    "access-control-allow-origin": allow ?? "",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type,idempotency-key",
    "access-control-allow-credentials": "true",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const idemKey = req.headers.get("idempotency-key") ?? null;
    const body = await req.json();
    const parsed = Input.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map(i => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        },
        { status: 400, headers: corsHeaders() }
      );
    }
    const input = parsed.data;

    // Switch passport to internal on transplant
    const userId = null; // TODO auth
    await switchPassportToInternal(params.batchId, userId);


    const param = params.batchId;

    // Resolve source batch by Firestore doc id OR by batchNumber (fallback)
    let srcRef = adminDb.collection("batches").doc(param);
    let srcSnap = await srcRef.get();

    if (!srcSnap.exists) {
      const byNumber = await adminDb
        .collection("batches")
        .where("batchNumber", "==", param)
        .limit(1)
        .get();
      if (byNumber.empty) {
        return NextResponse.json(
          { error: "source batch not found" },
          { status: 404, headers: corsHeaders() }
        );
      }
      srcRef = byNumber.docs[0].ref;
      srcSnap = byNumber.docs[0];
    }

    const src = srcSnap.data()!;
    const qty = input.quantity;

    if (qty > (src.quantity ?? 0)) {
      return NextResponse.json(
        { error: `quantity ${qty} exceeds available ${src.quantity}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    const { id: childBatchNumber } = await generateNextBatchId({ when: new Date(input.plantingDate) });

    const result = await adminDb.runTransaction(async (tx) => {
      const fresh = (await tx.get(srcRef)).data();
      if (!fresh) throw new Error("source batch not found");
      if (qty > (fresh.quantity ?? 0)) {
        throw new Error(`quantity ${qty} exceeds available ${fresh.quantity}`);
      }

      // Idempotency guard
      if (idemKey) {
        const idemRef = adminDb
          .collection("idempotency")
          .doc(`transplant:${srcRef.id}:${idemKey}`);
        const idemSnap = await tx.get(idemRef);
        if (idemSnap.exists) {
          const { newId } = idemSnap.data() as any;
          const existing = await adminDb.collection("batches").doc(newId).get();
          return {
            batchId: newId,
            batchNumber: existing.get("batchNumber"),
          };
        }
        tx.set(idemRef, { createdAt: new Date().toISOString() });
      }

      const newId = adminDb.collection("batches").doc().id;
      const newRef = adminDb.collection("batches").doc(newId);

      const newDoc = {
        batchNumber: childBatchNumber,
        category: fresh.category,
        plantFamily: fresh.plantFamily,
        plantVariety: fresh.plantVariety,
        plantingDate: new Date(input.plantingDate).toISOString(),
        initialQuantity: qty,
        quantity: qty,
        status: "Propagation", // initial status after transplant
        locationId: input.locationId ?? null,
        location: input.location ?? null,
        size: input.size,
        transplantedFrom: fresh.batchNumber,
        notes: input.notes ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      tx.set(newRef, newDoc);

      const remaining = (fresh.quantity ?? 0) - qty;
      const srcPatch: Record<string, any> = {
        quantity: remaining,
        updatedAt: new Date().toISOString(),
      };
      if (input.logRemainingAsLoss) srcPatch.status = "Archived";
      tx.update(srcRef, srcPatch);

      // Append history
      const hist = adminDb.collection("batchHistory");
      tx.set(hist.doc(), {
        at: new Date().toISOString(),
        type: "TRANSPLANT",
        batchId: srcRef.id,
        title: `Transplanted ${qty} to ${childBatchNumber} (${input.size})`,
        details:
          input.location
            ? `To ${input.location}`
            : input.locationId
            ? `To ${input.locationId}`
            : undefined,
      });
      tx.set(hist.doc(), {
        at: new Date().toISOString(),
        type: "BATCH_CREATED",
        batchId: newId,
        title: `New batch from ${fresh.batchNumber}`,
        details: `Initial qty ${qty}, size ${input.size}`,
      });

      if (idemKey) {
        tx.set(
          adminDb
            .collection("idempotency")
            .doc(`transplant:${srcRef.id}:${idemKey}`),
          { newId },
          { merge: true }
        );
      }

      return { batchId: newId, batchNumber: childBatchNumber };
    });

    return NextResponse.json(
      { ok: true, newBatch: result },
      { status: 201, headers: corsHeaders() }
    );
  } catch (e: any) {
    const msg = e?.message ?? "unknown error";
    const status = /not found/.test(msg)
      ? 404
      : /exceeds/.test(msg)
      ? 400
      : 500;
    return NextResponse.json(
      { error: msg },
      { status, headers: corsHeaders() }
    );
  }
}
