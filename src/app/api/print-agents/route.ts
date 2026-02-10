import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";
import { requireRole } from "@/server/auth/getUser";
import { createHash, randomBytes } from "crypto";
import { logger } from "@/server/utils/logger";

// Generate a secure API key with prefix
function generateAgentKey(): { key: string; hash: string; prefix: string } {
  const randomPart = randomBytes(32).toString("hex");
  const key = `pa_${randomPart}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.substring(0, 11); // "pa_" + first 8 chars
  return { key, hash, prefix };
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("print_agents")
      .select("id, name, status, last_seen_at, workstation_info, agent_key_prefix, created_at, updated_at")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch print agents";
    logger.api.error("GET /api/print-agents failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Only admins and owners can create print agents
    const roleCheck = await requireRole(['owner', 'admin']);
    if (!roleCheck.authorized) {
      return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });
    }

    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    }

    // Generate secure API key
    const { key, hash, prefix } = generateAgentKey();

    const { data, error } = await supabase
      .from("print_agents")
      .insert({
        org_id: orgId,
        name: name.trim(),
        agent_key: hash,
        agent_key_prefix: prefix,
        status: "offline",
        created_by: user?.id,
      })
      .select("id, name, status, agent_key_prefix, created_at")
      .single();

    if (error) throw error;

    // Return the agent data along with the plain-text key (shown only once)
    return NextResponse.json({
      data,
      agentKey: key, // This is the only time the full key is returned
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create print agent";
    logger.api.error("POST /api/print-agents failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
