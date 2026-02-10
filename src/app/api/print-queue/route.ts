import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";
import { logger } from "@/server/utils/logger";

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // Optional filter: pending, sent, completed, failed
    const agentId = searchParams.get("agentId"); // Optional filter by agent
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    let query = supabase
      .from("print_queue")
      .select(`
        id,
        job_type,
        copies,
        status,
        error_message,
        created_at,
        sent_at,
        completed_at,
        printer:printers(id, name),
        agent:print_agents(id, name)
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch print queue";
    logger.api.error("GET /api/print-queue failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
