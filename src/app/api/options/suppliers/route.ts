// src/app/api/options/suppliers/route.ts
import { NextResponse } from "next/server";
import { getActiveOrgIdOrThrow, getSupabaseForRequest } from "@/server/db/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const supabase = getSupabaseForRequest();
    let orgId: string;
    try {
      orgId = await getActiveOrgIdOrThrow(supabase);
    } catch (e: any) {
      return NextResponse.json({ options: [], error: e?.message || "Unauthorized" }, { status: 401 });
    }


    const query = supabase
      .from("suppliers")
      .select("id,name,producer_code,country_code")
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .limit(50);

    const { data, error } = await (q
      ? query.ilike("name", `%${q}%`)
      : query);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const options = (data ?? []).map(s => ({
      value: s.id,
      label: s.name,
      meta: { producer_code: s.producer_code, country_code: s.country_code },
    }));
    return NextResponse.json({ options });
  } catch (e: any) {
    console.error("[options/suppliers] unhandled", e);
    return NextResponse.json({ options: [], error: "Unexpected error" }, { status: 500 });
  }
}
