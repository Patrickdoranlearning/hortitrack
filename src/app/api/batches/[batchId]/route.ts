export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { z } from "zod";
import { BatchSchema } from "@/lib/types";
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

const Update = BatchSchema.partial();

export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = await req.json();
    const data = Update.parse(body);
    const ref = adminDb.collection("batches").doc(params.batchId);
    await ref.set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
    const snap = await ref.get();
    return NextResponse.json({ id: snap.id, ...declassify(snap.data()) });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      const msg = toMessage(e.errors);
      return NextResponse.json({ error: msg, issues: e.errors }, { status: 400 });
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
