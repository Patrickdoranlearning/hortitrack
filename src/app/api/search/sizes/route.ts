import { NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/server/db/supabaseServer"; // Updated import
import { snakeToCamel } from "@/lib/utils";

export async function GET(req: Request) {
  const supabase = getSupabaseForRequest(); // Updated call
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  const { data, error } = await supabase
    .from("plant_sizes")
    .select("id,name,container_type,multiple") // Added multiple to selection
    .ilike("name", q ? `%${q}%` : "%")
    .order("name")
    .limit(20);

  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 200 });

  return NextResponse.json({
    items: (data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      meta: { containerType: s.container_type, multiple: s.multiple }
    }))
  });
}
