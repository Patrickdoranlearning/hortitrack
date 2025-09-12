import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { data, error } = await supabase
      .from("batches")
      .select("id, batch_number, quantity")
      .eq("org_id", orgId)
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ batch: data });
  } catch (e: any) {
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 500;
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status });
  }
}
