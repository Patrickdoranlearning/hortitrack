
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProtocolFromBatch } from "@/server/protocols/service";

const Schema = z.object({
  batchId: z.string().min(8),
  name: z.string().min(3).max(120).optional(),
  publish: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = Schema.parse(body);
    const proto = await createProtocolFromBatch(input.batchId, { name: input.name, publish: input.publish });
    return NextResponse.json({ protocol: proto }, { status: 201 });
  } catch (err: any) {
    if (err?.issues) return NextResponse.json({ error: "Validation failed", details: err.issues }, { status: 422 });
    if (err?.message === "Batch not found.") return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    console.error("protocol generate error", err);
    return NextResponse.json({ error: "Failed to generate protocol" }, { status: 500 });
  }
}
