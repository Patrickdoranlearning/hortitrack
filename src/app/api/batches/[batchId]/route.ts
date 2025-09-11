
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { z } from "zod";
import { BatchSchema, BatchStatus } from "@/lib/types";
import { declassify } from "@/server/utils/declassify";
import { toMessage } from "@/lib/errors";

type Params = { params: { batchId: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ref = adminDb.collection("batches").doc(params.batchId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok:false, error: { code:"NOT_FOUND", message:"Not found" } }, { status: 404 });
    }
    const batch = { id: snap.id, ...declassify(snap.data()) } as any;

    // Photos (split by type)
    const photosSnap = await ref.collection("photos").orderBy("createdAt", "desc").limit(60).get();
    const photos = photosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const photosSplit = { grower: photos.filter(p => p.type === "GROWER"), sales: photos.filter(p => p.type === "SALES") };

    // Logs (legacy inline logHistory)
    const logs = Array.isArray(batch.logHistory) ? batch.logHistory.slice(-50) : [];

    // Ancestry: follow `transplantedFrom` or `ancestryFromId` up to 3
    const ancestry: any[] = [];
    let prevId = batch.transplantedFrom || batch.ancestryFromId || null;
    for (let hops = 0; prevId && hops < 3; hops++) {
      const prevSnap = await adminDb.collection('batches').where('batchNumber', '==', prevId).limit(1).get();
      if (prevSnap.empty) break;

      const prevDoc = prevSnap.docs[0];
      const d = prevDoc.data() || {};
      ancestry.push({
        id: prevDoc.id,
        batchNumber: d.batchNumber ?? prevDoc.id,
        plantVariety: d.plantVariety ?? d.variety ?? "",
        plantFamily: d.plantFamily ?? "",
        size: d.size ?? "",
        supplier: d.supplier ?? d.supplierName ?? null,
        producedWeek: d.plantingDateWeek ?? d.producedWeek ?? null,
      });
      prevId = d.transplantedFrom || d.ancestryFromId || null;
    }

    return NextResponse.json({ ok:true, data: { batch, logs, photos: photosSplit, ancestry } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: { code:"SERVER_ERROR", message: toMessage(e) } }, { status: 500 });
  }
}

const PatchBody = z.object({
  // explicitly allow only updatable fields
  category: z.string().min(1).optional(),
  plantFamily: z.string().min(1).optional(),
  plantVariety: z.string().min(1).optional(),
  plantingDate: z.string().optional(), // ISO
  quantity: z.number().int().nonnegative().optional(),
  status: BatchStatus.optional(),
  location: z.string().optional(),
  size: z.string().optional(),
  supplier: z.string().optional(),
  growerPhotoUrl: z.string().optional(),
  salesPhotoUrl: z.string().optional(),
  // logHistory is appended server-side when we auto-archive; disallow blind replacement from clients
}).strict();

export async function PATCH(req: Request, { params }: Params) {
  try {
    const updates = PatchBody.parse(await req.json());
    const ref = adminDb.collection("batches").doc(params.batchId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const stored = declassify(snap.data());
    const initialQty: number = stored.initialQuantity ?? 0;
    const nextQty: number = (typeof updates.quantity === "number") ? updates.quantity : stored.quantity ?? 0;
    const nextStatus: typeof stored.status = updates.status ?? stored.status;

    if (nextQty > initialQty) {
      return NextResponse.json({ error: "Quantity cannot exceed initial quantity." }, { status: 400 });
    }

    const shouldArchive = nextQty <= 0 || nextStatus === "Archived";
    const serverUpdate: Record<string, any> = {
      ...updates,
      quantity: shouldArchive ? 0 : nextQty,
      status: shouldArchive ? "Archived" : nextStatus,
      updatedAt: new Date().toISOString(),
    };

    // Append auto-archive log if transitioning to Archived now
    const becameArchived = shouldArchive && stored.status !== "Archived";
    if (becameArchived) {
      const logEntry = {
        id: `log_${Date.now()}`,
        date: new Date().toISOString(),
        type: "ARCHIVE",
        note: "Batch quantity reached zero and was automatically archived.",
      };
      serverUpdate.logHistory = [...(stored.logHistory ?? []), logEntry];
    }

    await ref.set(serverUpdate, { merge: true });
    const finalSnap = await ref.get();
    return NextResponse.json({ id: finalSnap.id, ...declassify(finalSnap.data()) });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: toMessage(e.errors), issues: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: toMessage(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    // Soft-delete? Archive instead of delete (preferred)
    const ref = adminDb.collection("batches").doc(params.batchId);
    await ref.set({ status: "Archived", updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: toMessage(e) }, { status: 500 });
  }
}
