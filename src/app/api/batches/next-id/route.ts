
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateNextBatchId } from "@/server/batches/nextId";
import { logger } from "@/server/utils/logger";

const Query = z.object({ phase: z.enum(["PROPAGATION", "PLUGS", "POTTING"]) });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = Query.parse({ phase: searchParams.get("phase") });
    const { id, seq, yyww } = await generateNextBatchId(parsed.phase);
    return NextResponse.json({ ok: true, id, seq, yyww });
  } catch (e: any) {
    logger.api.error("GET /api/batches/next-id failed", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "failed" }, { status: 400 });
  }
}
