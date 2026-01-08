import { NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { listCategories } from "@/server/materials/service";

export const runtime = "nodejs";
// Categories are shared (no org filtering), can be cached
export const revalidate = 3600; // Cache for 1 hour

/**
 * GET /api/materials/categories
 * List all material categories (shared across orgs)
 */
export async function GET() {
  try {
    const supabase = await getSupabaseServerApp();
    const categories = await listCategories(supabase);

    return NextResponse.json(
      { categories },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error: unknown) {
    console.error("[materials/categories GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch categories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
