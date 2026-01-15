import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { agentId } = await context.params;
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("print_agents")
      .select("id, name, status, last_seen_at, workstation_info, agent_key_prefix, created_at, updated_at")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch print agent";
    console.error("[api/print-agents/[agentId]] GET error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { agentId } = await context.params;
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Agent name cannot be empty" }, { status: 400 });
      }
      updates.name = name.trim();
    }

    const { data, error } = await supabase
      .from("print_agents")
      .update(updates)
      .eq("id", agentId)
      .eq("org_id", orgId)
      .select("id, name, status, last_seen_at, workstation_info, agent_key_prefix, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update print agent";
    console.error("[api/print-agents/[agentId]] PUT error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { agentId } = await context.params;
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    // Check if agent exists and belongs to org
    const { data: existing, error: fetchError } = await supabase
      .from("print_agents")
      .select("id")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Delete the agent (this will cascade to print_queue entries)
    const { error } = await supabase
      .from("print_agents")
      .delete()
      .eq("id", agentId)
      .eq("org_id", orgId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to delete print agent";
    console.error("[api/print-agents/[agentId]] DELETE error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
