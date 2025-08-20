export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";

const Input = z.object({
  type: z.enum(["MOVE", "DUMP", "CHECKIN", "NOTE"]),
  at: z.string().datetime(),
  // MOVE: optional quantity, required destination
  toLocationId: z.string().optional(),
  toLocation: z.string().optional(),
  // QUANTITY: optional for MOVE (defaults to full), required for DUMP (defaults to full if omitted)
  quantity: z.number().int().positive().optional(),
  reason: z.string().optional(), // DUMP requires reason
  notes: z.string().optional(),
  photos: z.array(
    z.object({
      url: z.string().url(),
      path: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
  ).optional(),
});

function corsHeaders() {
  const allow = process.env.NODE_ENV === "development" ? "*" : "";
  return {
    "access-control-allow-origin": allow,
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
  const idemKey = req.headers.get("idempotency-key") ?? null;

  try {
    const raw = await req.json();
    const input = Input.parse(raw);
    const { type } = input;

    // Resolve batch by doc id or batchNumber
    const param = params.batchId;
    let batchRef = adminDb.collection("batches").doc(param);
    let snap = await batchRef.get();
    if (!snap.exists) {
      const alt = await adminDb.collection("batches")
        .where("batchNumber", "==", param)
        .limit(1).get();
      if (alt.empty) {
        return NextResponse.json({ error: "batch not found" }, { status: 404, headers: corsHeaders() });
      }
      batchRef = alt.docs[0].ref; snap = alt.docs[0];
    }
    const batch = snap.data()!;
    const available = Number(batch.quantity ?? 0);

    // Idempotency guard
    const idemRef = idemKey
      ? adminDb.collection("idempotency").doc(`action:${batchRef.id}:${idemKey}`)
      : null;

    const result = await adminDb.runTransaction(async (tx) => {
      const freshSnap = await tx.get(batchRef);
      if (!freshSnap.exists) throw new Error("batch not found");
      const fresh = freshSnap.data()!;
      const currentQty = Number(fresh.quantity ?? 0);

      if (idemRef) {
        const idemSnap = await tx.get(idemRef);
        if (idemSnap.exists) {
          // Return saved result without re-applying side effects
          return idemSnap.data();
        }
      }

      const now = new Date(input.at);
      const actionsCol = adminDb.collection("batchActions");
      const historyCol = adminDb.collection("batchHistory");
      const actionId = actionsCol.doc().id;

      // Defaults / validations per type
      let delta = 0; // negative reduces quantity
      if (type === "MOVE") {
        if (!input.toLocationId && !input.toLocation) {
          throw new Error("destination is required for MOVE");
        }
        // quantity optional; default to full for logging only
        const q = input.quantity ?? currentQty;

        tx.update(batchRef, {
          locationId: input.toLocationId ?? null,
          location: input.toLocation ?? null,
          updatedAt: new Date().toISOString(),
        });

        tx.set(historyCol.doc(), {
          at: now.toISOString(),
          type: "MOVE",
          batchId: batchRef.id,
          title: `Moved ${q} units`,
          details: input.toLocation ?? input.toLocationId ?? "",
        });

        tx.set(actionsCol.doc(actionId), {
          at: now.toISOString(),
          type,
          batchId: batchRef.id,
          quantity: q,
          toLocationId: input.toLocationId ?? null,
          toLocation: input.toLocation ?? null,
          notes: input.notes ?? null,
          photos: input.photos ?? [],
        });
      }

      if (type === "DUMP") {
        const q = input.quantity ?? currentQty;
        if (q > currentQty) throw new Error(`quantity ${q} exceeds available ${currentQty}`);
        if (!input.reason || input.reason.trim().length === 0) {
          throw new Error("reason is required for DUMP");
        }
        const remaining = currentQty - q;
        const patch: Record<string, any> = {
          quantity: remaining,
          updatedAt: new Date().toISOString(),
        };
        if (remaining === 0) patch.status = "Archived";

        tx.update(batchRef, patch);

        tx.set(historyCol.doc(), {
          at: now.toISOString(),
          type: "DUMP",
          batchId: batchRef.id,
          title: `Dumped ${q} units`,
          details: input.reason,
        });

        tx.set(actionsCol.doc(actionId), {
          at: now.toISOString(),
          type,
          batchId: batchRef.id,
          quantity: q,
          reason: input.reason,
          notes: input.notes ?? null,
          photos: input.photos ?? [],
        });

        delta = -q;
      }

      if (type === "CHECKIN" || type === "NOTE") {
        tx.set(historyCol.doc(), {
          at: now.toISOString(),
          type,
          batchId: batchRef.id,
          title: type === "CHECKIN" ? "Batch check-in" : "Note added",
          details: input.notes ?? "",
        });

        tx.set(actionsCol.doc(actionId), {
          at: now.toISOString(),
          type,
          batchId: batchRef.id,
          notes: input.notes ?? null,
          photos: input.photos ?? [],
        });
      }

      const response = {
        ok: true,
        actionId,
        type,
        appliedDelta: delta,
        batch: {
          id: batchRef.id,
          quantityAfter: type === "DUMP" ? currentQty + delta : currentQty,
        },
      };

      if (idemRef) tx.set(idemRef, response, { merge: true });
      return response;
    });

    return NextResponse.json(result, { status: 201, headers: corsHeaders() });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = /exceeds/.test(msg) || /required/.test(msg) ? 400
      : /not found/.test(msg) ? 404 : 500;
    return NextResponse.json({ error: msg }, { status, headers: corsHeaders() });
  }
}
