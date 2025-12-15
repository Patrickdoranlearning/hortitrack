import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, orgId } = await getUserAndOrg();
    const { data: rows, error } = await supabase
      .from("batch_events")
      .select("id, type, at, created_at, by_user_id, payload")
      .eq("org_id", orgId)
      .eq("batch_id", id)
      .order("at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: rows ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
