import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Q = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = Q.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) return NextResponse.json({ options: [] });

  const supabase = getSupabaseForRequest();

  // require auth + active org
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ options: [] });

  const { data: profile } = await supabase
    .from("profiles").select("active_org_id").eq("id", auth.user.id).maybeSingle();
  if (!profile?.active_org_id) return NextResponse.json({ options: [] });

  const { q, limit } = parse.data;

  // DISTINCT site names from locations in this org
  const { data, error } = await supabase
    .from("nursery_locations")
    .select("nursery_site")
    .eq("org_id", profile.active_org_id);

  if (error) {
    console.error("[options.sites]", error);
    return NextResponse.json({ options: [] });
  }

  let names = Array.from(new Set((data ?? []).map(r => (r as any).nursery_site as string))).sort((a, b) =>
    (a || "").localeCompare(b || "")
  );

  if (q) {
    const ql = q.toLowerCase();
    names = names.filter(n => n.toLowerCase().includes(ql));
  }

  names = names.slice(0, limit);

  return NextResponse.json({
    options: names.map(n => ({ value: n, label: n })),
  });
}