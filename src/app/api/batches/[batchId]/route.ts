
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
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ id: snap.id, ...declassify(snap.data()) });
  } catch (e: any) {
    return NextResponse.json({ error: toMessage(e) }, { status: 500 });
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
