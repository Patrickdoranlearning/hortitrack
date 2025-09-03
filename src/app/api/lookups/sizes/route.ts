import { NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

export async function GET(req: Request) {
  try {
    const sb = getSupabaseForRequest(req);
    const { data, error } = await sb
      .from("plant_sizes")
      .select("id, name, container_type, cell_multiple")
      .order("name", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ sizes: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to load sizes" }, { status: 500 });
  }
}
