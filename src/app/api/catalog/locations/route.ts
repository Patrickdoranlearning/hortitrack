
// src/app/api/catalog/locations/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/server/auth/org";
import { safeIlikePattern } from "@/server/db/sanitize";

const Query = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(50).default(50),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parse = Query.safeParse(Object.fromEntries(searchParams));
    if (!parse.success) return NextResponse.json({ error: parse.error.format() }, { status: 400 });

    const { q, limit } = parse.data;
    const supabase = await createClient();
    
    // Fetch the active organization ID for the current user
    const orgId = await getActiveOrgId(supabase);

    let query = supabase
      .from("nursery_locations")
      .select("id,name")
      .eq("org_id", orgId) // Filter by the user's active organization
      .order("name", { ascending: true })
      .limit(limit);

    if (q && q.length > 0) {
      query = query.ilike("name", safeIlikePattern(q));
    }

    const { data, error } = await query;
    if (error) {
      console.error("[catalog.locations] select error", error);
      return NextResponse.json({ error: "Failed to load locations" }, { status: 500 });
    }

    // The AsyncCombobox expects an array of objects, not an object with a property.
    return NextResponse.json(data.map(l => ({ value: l.id, label: l.name })));
  } catch (e: any) {
    // Handle cases where user is not authenticated or has no active org
    if (e.message.includes("Unauthenticated") || e.message.includes("No active org")) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[catalog.locations] unhandled error", e);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
