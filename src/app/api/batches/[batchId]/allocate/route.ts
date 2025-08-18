import { NextResponse } from "next/server";
import { z } from "zod";
import { generateBatchNumber, type BatchStage } from "@/server/services/batchNumber";
import { adminDb } from "@/server/db/admin";

const Body = z.object({
  stage: z.enum(["propagation", "plug", "potting"]),
});

type Params = { params: { batchId: string } };

export async function POST(req: Request, { params }: Params) {
  try {
    const body = Body.parse(await req.json());
    const number = await generateBatchNumber({ stage: body.stage as BatchStage });
    await adminDb.collection("batches").doc(params.batchId).set({ batchNumber: number }, { merge: true });
    return NextResponse.json({ batchNumber: number }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
