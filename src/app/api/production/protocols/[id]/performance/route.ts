import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getProtocolPerformanceStats } from "@/server/production/protocol-performance";
import { logger } from "@/server/utils/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: protocolId } = await params;
    const { supabase, orgId } = await getUserAndOrg();

    // Verify user has access to this protocol
    const { data: protocol, error: protocolError } = await supabase
      .from("protocols")
      .select("id")
      .eq("id", protocolId)
      .eq("org_id", orgId)
      .single();

    if (protocolError || !protocol) {
      return NextResponse.json(
        { error: "Protocol not found" },
        { status: 404 }
      );
    }

    const stats = await getProtocolPerformanceStats(supabase, orgId, protocolId);

    if (!stats) {
      return NextResponse.json(
        { error: "Failed to fetch performance stats" },
        { status: 500 }
      );
    }

    return NextResponse.json(stats);
  } catch (err) {
    logger.production.error("Protocol performance stats fetch failed", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

