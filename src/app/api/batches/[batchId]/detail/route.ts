import { NextRequest } from "next/server";
import { getBatchDetail } from "@/server/batch-detail";

export async function GET(_req: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const batchId = params.batchId;
    if (!batchId) return new Response(JSON.stringify({ error: "Missing batchId" }), { status: 400 });

    // TODO: RBAC check if needed
    const detail = await getBatchDetail(batchId);
    if (!detail) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

    return new Response(JSON.stringify(detail), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("GET /detail error", { message: e?.message });
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}
