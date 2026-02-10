import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";
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

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { agentId } = await context.params;
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    // Verify agent exists and belongs to org
    const { data: existing, error: fetchError } = await supabase
      .from("print_agents")
      .select("id, name")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Generate new secure API key
    const { key, hash, prefix } = generateAgentKey();

    // Update the agent with new key (this invalidates the old key)
    const { data, error } = await supabase
      .from("print_agents")
      .update({
        agent_key: hash,
        agent_key_prefix: prefix,
        status: "offline", // Force offline since old key is now invalid
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .eq("org_id", orgId)
      .select("id, name, status, agent_key_prefix, updated_at")
      .single();

    if (error) throw error;

    // Return the agent data along with the new plain-text key (shown only once)
    return NextResponse.json({
      data,
      agentKey: key, // This is the only time the full key is returned
      message: "API key regenerated. The agent will need to be reconfigured with the new key.",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to regenerate API key";
    logger.api.error("POST /api/print-agents/[agentId]/regenerate-key failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
