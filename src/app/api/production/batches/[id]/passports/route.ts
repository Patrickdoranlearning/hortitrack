import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, props: RouteProps) {
  try {
    const { params } = props;
    const { id } = await params;
    const { supabase, orgId } = await getUserAndOrg();
    const { data: rows, error } = await supabase
      .from("batch_passports")
      .select("id, passport_type, operator_reg_no, traceability_code, origin_country, created_at, images")
      .eq("org_id", orgId)
      .eq("batch_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: rows ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
