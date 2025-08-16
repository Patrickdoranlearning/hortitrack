
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { z } from "zod";

const Schema = z.object({ value: z.boolean() });

export async function PATCH(req: NextRequest, { params }: { params: { batchId: string } }) {
  const id = params.batchId;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    const body = await req.json();
    const { value } = Schema.parse(body);

    await adminDb.collection("batches").doc(id).set(
      { isTopPerformer: value, topPerformerAt: value ? new Date() : null },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: "Validation failed", details: e.issues }, { status: 422 });
    console.error("top performer flag error", e);
    return NextResponse.json({ error: "Failed to set top performer" }, { status: 500 });
  }
}
