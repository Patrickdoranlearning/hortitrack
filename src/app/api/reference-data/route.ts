import { NextRequest, NextResponse } from "next/server";
import { getLightweightAuth } from "@/lib/auth/lightweight";
import { getCachedReferenceData } from "@/lib/cache/reference-data";

/**
 * Returns reference data for the UI.
 * Optimized: 
 * - Lightweight auth (caches org lookup)
 * - Service_role for data fetching (bypasses RLS overhead)
 * - In-memory caching (works in dev mode)
 */
export async function GET(_req: NextRequest) {
  const results = {
    varieties: [] as any[],
    sizes: [] as any[],
    locations: [] as any[],
    suppliers: [] as any[],
    materials: [] as any[],
    errors: [] as string[],
  };

  try {
    // Lightweight auth - caches org lookup
    const { orgId } = await getLightweightAuth();

    // Get cached reference data (uses service_role, in-memory cache)
    const cachedData = await getCachedReferenceData(orgId);
    results.varieties = cachedData.varieties;
    results.sizes = cachedData.sizes;
    results.locations = cachedData.locations;
    results.suppliers = cachedData.suppliers;
    results.materials = cachedData.materials;

  } catch (e: any) {
    const isAuthError = /Unauthenticated|No organization/i.test(e?.message);
    if (isAuthError) {
      results.errors.push(e.message);
      return NextResponse.json(results, { status: 401 });
    }
    console.error("[reference-data] error:", e);
    results.errors.push(e?.message ?? "Failed to fetch reference data");
  }

  // Add cache headers for browser/CDN caching (60 seconds)
  return NextResponse.json(results, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
    },
  });
}
