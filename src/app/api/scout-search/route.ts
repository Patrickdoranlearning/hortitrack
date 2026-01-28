import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";

export const runtime = "nodejs";

/**
 * Fast unified search for Scout Mode
 * Uses database RPC function for single-roundtrip batch search
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    
    if (q.length < 2) {
      return NextResponse.json({ locations: [], batches: [] });
    }

    const { orgId, user, supabase } = await getUserAndOrg();

    // Rate limit: 60 search requests per minute per user
    const rlKey = `scout:search:${requestKey(req, user.id)}`;
    const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests", resetMs: rl.resetMs },
        { status: 429 }
      );
    }

    const searchPattern = `%${q}%`;

    // Fast parallel search using RPC for batches
    const [locationsResult, batchesResult] = await Promise.all([
      // Location search
      supabase
        .from("nursery_locations")
        .select("id, name, type, nursery_site")
        .eq("org_id", orgId)
        .ilike("name", searchPattern)
        .limit(6),

      // Batch search via RPC (single query for batch number + variety + family)
      supabase.rpc('search_batches_for_scout', {
        p_org_id: orgId,
        p_search: q,
        p_limit: 8
      })
    ]);

    // Map locations
    const locations = (locationsResult.data || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      description: l.type || l.nursery_site,
    }));

    // Map batches from RPC result
    const batches = (batchesResult.data || []).map((b: any) => ({
      id: b.id,
      batchNumber: b.batch_number,
      variety: b.variety_name,
      family: b.variety_family,
      locationId: b.location_id,
      locationName: b.location_name,
    }));
    
    return NextResponse.json({ locations, batches });
  } catch (e: any) {
    console.error("[api/scout-search] error", e);
    return NextResponse.json({ locations: [], batches: [], error: e?.message }, { status: 500 });
  }
}
