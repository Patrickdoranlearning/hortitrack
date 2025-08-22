// src/app/api/batches/propagation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createPropagationBatch } from "@/server/batches/service";
import { PropagationFormSchema } from "@/types/batch";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = PropagationFormSchema.parse(json);
    // TODO: replace with your auth
    const userId = null;
    const batch = await createPropagationBatch({ input, userId });
    return NextResponse.json(batch, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Invalid input" }, { status: 400 });
  }
}
