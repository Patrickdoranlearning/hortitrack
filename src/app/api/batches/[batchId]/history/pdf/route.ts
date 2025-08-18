import { NextRequest, NextResponse } from "next/server";
import { buildBatchHistory } from "@/server/batches/history";
import { renderHistoryPdf } from "@/server/history/pdf";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { batchId: string } }) {
  const id = decodeURIComponent(params.batchId || "").trim();
  if (!id || id.includes("/")) return NextResponse.json({ error: "Invalid id" }, { status: 422 });
  try {
    const data = await buildBatchHistory(id);
    const pdf = await renderHistoryPdf(data);
    const filename = `batch_history_${(data.batch.batchNumber || id).toString().replace(/[^\w\-]+/g, "_")}.pdf`;
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[history/pdf] error", e);
    return NextResponse.json({ error: "Failed to render history" }, { status: 500 });
  }
}
