
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import { generateNextBatchId, BatchPhase } from "@/server/batches/nextId";

const Body = z.object({
  phase: z.enum(["PROPAGATION", "PLUGS", "POTTING"]),
});

type Params = { params: { batchId: string } };

export async function POST(req: Request, { params }: Params) {
  try {
    const body = Body.parse(await req.json());
    const { id: batchNumber } = await generateNextBatchId(body.phase as BatchPhase);
    await adminDb.collection("batches").doc(params.batchId).set({ batchNumber }, { merge: true });
    return NextResponse.json({ batchNumber }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
