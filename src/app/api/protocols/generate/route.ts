import { NextRequest, NextResponse } from "next/server";
import { createProtocolFromBatch } from "@/server/protocols/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const batchId = typeof body?.batchId === "string" ? body.batchId.trim() : "";
  if (!batchId || batchId.length < 6) {
    return NextResponse.json({ error: "batchId is required" }, { status: 422 });
  }

  const name = typeof body?.name === "string" ? body.name.slice(0, 120) : undefined;
  const publish = Boolean(body?.publish);

  try {
    const proto = await createProtocolFromBatch(batchId, { name, publish });
    return NextResponse.json({ protocol: proto }, { status: 201 });
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes("Batch not found")) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }
    console.error("[protocols/generate] error:", err);
    return NextResponse.json({ error: "Failed to generate protocol" }, { status: 500 });
  }
}
