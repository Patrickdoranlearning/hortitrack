import { NextResponse } from "next/server";
import { getLightweightAuth } from "@/lib/auth/lightweight";
import { getCachedLocations } from "@/lib/cache/reference-data";

export async function GET() {
  try {
    // Lightweight auth - caches org lookup
    const { orgId } = await getLightweightAuth();
    
    // Use in-memory cached locations (service_role, no RLS overhead)
    const locations = await getCachedLocations(orgId);

    return NextResponse.json(
      { items: locations },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (e: any) {
    const status = /Unauthenticated|No organization/i.test(e?.message) ? 401 : 500;
    console.error("[lookups/locations] error", e);
    return NextResponse.json({ error: e?.message ?? "Lookup failed" }, { status });
  }
}
