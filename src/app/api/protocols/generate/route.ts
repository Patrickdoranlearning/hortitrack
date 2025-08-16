import { NextRequest, NextResponse } from "next/server";
import { createProtocolFromBatch } from "@/server/protocols/service";
import { renderProtocolPdf } from "@/server/protocols/pdf";
import { isValidDocId } from "@/server/util/ids";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const rawId = typeof body?.batchId === "string" ? body.batchId.trim() : "";
  if (!rawId) return NextResponse.json({ error: "batchId is required" }, { status: 422 });
  if (!isValidDocId(rawId)) return NextResponse.json({ error: "Invalid batch id" }, { status: 422 });
  const batchId = rawId;

  const name = typeof body?.name === "string" ? body.name.slice(0, 120) : undefined;
  const publish = Boolean(body?.publish);

  const url = new URL(req.url);
  const wantsPdf = url.searchParams.get("download") === "pdf" || req.headers.get("accept")?.includes("application/pdf");

  try {
    let proto: any;
    try {
      proto = await createProtocolFromBatch(batchId, { name, publish });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("Invalid batch id")) return NextResponse.json({ error: "Invalid batch id", phase: "service" }, { status: 422 });
      if (msg.includes("Batch not found")) return NextResponse.json({ error: "Batch not found", phase: "service" }, { status: 404 });
      throw new Error(`service: ${msg}`);
    }

    if (!wantsPdf) {
      return NextResponse.json({ protocol: proto }, { status: 201 });
    }

    // Render and return as downloadable PDF
    let pdf: Uint8Array;
    try {
      pdf = await renderProtocolPdf(proto);
    } catch (e: any) {
      const detail = String(e?.message || e);
      const payload = { error: "PDF render failed", phase: "pdf", detail: process.env.NODE_ENV !== "production" ? detail : undefined };
      return NextResponse.json(payload, { status: 500 });
    }
    const filename = `${(proto.name || "Protocol").replace(/[^\w\-]+/g, "_")}.pdf`;
    return new NextResponse(pdf, {
      status: 201,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error("[protocols/generate] error:", { batchId, msg, stack: err?.stack });
    return NextResponse.json({ error: "Failed to generate protocol", phase: "unknown", detail: process.env.NODE_ENV !== "production" ? msg : undefined }, { status: 500 });
  }
}
