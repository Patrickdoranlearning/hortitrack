// src/app/api/batches/checkin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createCheckinBatch } from "@/server/batches/service";
import { CheckinFormSchema } from "@/types/batch";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = CheckinFormSchema.parse(json);
    const userId = null; // TODO: bind auth
    const batch = await createCheckinBatch({ input, userId });
    return NextResponse.json(batch, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Invalid input" }, { status: 400 });
  }
}
