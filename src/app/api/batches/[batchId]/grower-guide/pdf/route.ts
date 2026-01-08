import { NextRequest, NextResponse } from "next/server";
import { buildGrowerGuide } from "@/server/batches/grower-guide";
import { renderGrowerGuidePdf } from "@/server/batches/grower-guide-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const id = decodeURIComponent(batchId || "").trim();

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid batch ID" }, { status: 422 });
  }

  try {
    const data = await buildGrowerGuide(id);
    const pdf = await renderGrowerGuidePdf(data);

    const batchLabel = data.batch.batchNumber ?? id.slice(0, 8);
    const filename = `Grower_Guide_${batchLabel.toString().replace(/[^\w\-]+/g, "_")}.pdf`;

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    console.error("[grower-guide/pdf] error", e);
    const message = e instanceof Error ? e.message : "Failed to generate grower guide";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  return POST(req, context);
}
