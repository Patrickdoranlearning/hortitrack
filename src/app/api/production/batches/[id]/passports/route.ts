import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { data: rows, error } = await supabase
      .from("batch_passports")
      .select("id, passport_type, operator_reg_no, traceability_code, origin_country, created_at, images")
      .eq("org_id", orgId)
      .eq("batch_id", params.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: rows ?? [] });
  } catch (e: any) {
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 500;
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status });
  }
}
