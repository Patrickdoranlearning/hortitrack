import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

export async function GET() {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, producer_code, country_code, phone, email, address, eircode, supplier_type, updated_at")
      .eq("org_id", orgId)
      .order("name");

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 500;
    console.error("[lookups/suppliers] error", e);
    return NextResponse.json({ error: e?.message ?? "Lookup failed" }, { status });
  }
}
