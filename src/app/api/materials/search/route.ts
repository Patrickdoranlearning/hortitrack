import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SearchQuerySchema = z.object({
  q: z.string().trim().min(0).max(100).optional(),
  sizeId: z.string().uuid().optional(),
  barcode: z.string().optional(),
  partNumber: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

type MaterialResult = {
  id: string;
  part_number: string;
  name: string;
  description: string | null;
  category_name: string;
  parent_group: string;
  base_uom: string;
  linked_size_id: string | null;
  barcode: string | null;
  internal_barcode: string | null;
};

/**
 * GET /api/materials/search
 *
 * Search materials with support for:
 * - Text search (q): searches name, part_number, description
 * - Barcode lookup (barcode): exact match on barcode or internal_barcode
 * - Part number lookup (partNumber): exact or prefix match on part_number
 * - Size suggestions (sizeId): materials linked to a size appear first
 */
export async function GET(req: Request) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { searchParams } = new URL(req.url);

    const params = SearchQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );

    if (!params.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", issues: params.error.format() },
        { status: 400 }
      );
    }

    const { q, sizeId, barcode, partNumber, limit } = params.data;

    // If barcode is provided, do exact lookup first
    if (barcode) {
      const { data: barcodeMatch } = await supabase
        .from("materials")
        .select(`
          id,
          part_number,
          name,
          description,
          base_uom,
          linked_size_id,
          barcode,
          internal_barcode,
          category:material_categories(name, parent_group)
        `)
        .eq("org_id", orgId)
        .eq("is_active", true)
        .or(`barcode.eq.${barcode},internal_barcode.eq.${barcode}`)
        .limit(1);

      if (barcodeMatch && barcodeMatch.length > 0) {
        const material = mapMaterialResult(barcodeMatch[0]);
        return NextResponse.json({
          suggested: [],
          results: [material],
          matchType: "barcode",
        });
      }

      // No barcode match found
      return NextResponse.json({
        suggested: [],
        results: [],
        matchType: "barcode",
      });
    }

    // If partNumber is provided, do exact/prefix match
    if (partNumber) {
      const { data: partMatch } = await supabase
        .from("materials")
        .select(`
          id,
          part_number,
          name,
          description,
          base_uom,
          linked_size_id,
          barcode,
          internal_barcode,
          category:material_categories(name, parent_group)
        `)
        .eq("org_id", orgId)
        .eq("is_active", true)
        .ilike("part_number", `${partNumber}%`)
        .order("part_number", { ascending: true })
        .limit(limit);

      const results = (partMatch ?? []).map(mapMaterialResult);

      return NextResponse.json({
        suggested: [],
        results,
        matchType: "partNumber",
      });
    }

    // Get suggested materials (linked to the size) if sizeId provided
    let suggested: MaterialResult[] = [];
    if (sizeId) {
      const { data: linkedMaterials } = await supabase
        .from("materials")
        .select(`
          id,
          part_number,
          name,
          description,
          base_uom,
          linked_size_id,
          barcode,
          internal_barcode,
          category:material_categories(name, parent_group)
        `)
        .eq("org_id", orgId)
        .eq("is_active", true)
        .eq("linked_size_id", sizeId)
        .order("part_number", { ascending: true });

      suggested = (linkedMaterials ?? []).map(mapMaterialResult);
    }

    // Text search if q provided
    let results: MaterialResult[] = [];
    if (q && q.length > 0) {
      const searchTerm = q.replace(/[%_]/g, "\\$&"); // Escape SQL wildcards

      const { data: searchResults } = await supabase
        .from("materials")
        .select(`
          id,
          part_number,
          name,
          description,
          base_uom,
          linked_size_id,
          barcode,
          internal_barcode,
          category:material_categories(name, parent_group)
        `)
        .eq("org_id", orgId)
        .eq("is_active", true)
        .or(`name.ilike.%${searchTerm}%,part_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order("part_number", { ascending: true })
        .limit(limit);

      results = (searchResults ?? []).map(mapMaterialResult);

      // Remove duplicates (materials that appear in both suggested and results)
      const suggestedIds = new Set(suggested.map((m) => m.id));
      results = results.filter((m) => !suggestedIds.has(m.id));
    } else if (!sizeId) {
      // No search query and no sizeId - return some materials
      const { data: allMaterials } = await supabase
        .from("materials")
        .select(`
          id,
          part_number,
          name,
          description,
          base_uom,
          linked_size_id,
          barcode,
          internal_barcode,
          category:material_categories(name, parent_group)
        `)
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("part_number", { ascending: true })
        .limit(limit);

      results = (allMaterials ?? []).map(mapMaterialResult);
    }

    return NextResponse.json({
      suggested,
      results,
      matchType: "search",
    });
  } catch (error: unknown) {
    logger.materials.error("Materials search failed", error);
    const message = error instanceof Error ? error.message : "Search failed";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function mapMaterialResult(row: Record<string, unknown>): MaterialResult {
  const category = row.category as { name: string; parent_group: string } | null;

  return {
    id: row.id as string,
    part_number: row.part_number as string,
    name: row.name as string,
    description: row.description as string | null,
    category_name: category?.name ?? "Unknown",
    parent_group: category?.parent_group ?? "Other",
    base_uom: row.base_uom as string,
    linked_size_id: row.linked_size_id as string | null,
    barcode: row.barcode as string | null,
    internal_barcode: row.internal_barcode as string | null,
  };
}
