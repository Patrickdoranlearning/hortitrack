import { NextRequest, NextResponse } from "next/server";
import { createProtocolFromBatch } from "@/server/protocols/service";
import { isValidDocId } from "@/server/utils/ids";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("batchId") || "";
  if (!isValidDocId(id)) return NextResponse.json({ error: "Invalid batch id" }, { status: 422 });
  try {
    const proto = await createProtocolFromBatch(id, { publish: false });
    return NextResponse.json({ protocol: proto });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = msg.includes("Batch not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
