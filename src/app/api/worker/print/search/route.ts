import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { safeIlikePattern } from "@/server/db/sanitize";
import { logger } from "@/server/utils/logger";

/**
 * Worker Print Search API
 *
 * Searches for batches, locations, and material lots by name/number.
 * Used by the print hub to find items to print labels for.
 */

const QuerySchema = z.object({
  q: z.string().min(2).max(100),
});

interface SearchResult {
  type: "batch" | "location" | "lot";
  id: string;
  label: string;
  subLabel?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parse = QuerySchema.safeParse({ q: searchParams.get("q") });

    if (!parse.success) {
      return NextResponse.json(
        { error: "Search query must be 2-100 characters" },
        { status: 400 }
      );
    }

    const { q } = parse.data;
    const { supabase, orgId } = await getUserAndOrg();

    const results: SearchResult[] = [];

    // Search batches by batch_number or variety name
    const { data: batches, error: batchError } = await supabase
      .from("batches")
      .select(
        `
        id,
        batch_number,
        plant_varieties (name)
      `
      )
      .eq("org_id", orgId)
      .neq("status", "Archived")
      .or(`batch_number.ilike.${safeIlikePattern(q)}`)
      .limit(10);

    if (!batchError && batches) {
      for (const batch of batches) {
        const varieties = batch.plant_varieties as { name?: string } | null;
        results.push({
          type: "batch",
          id: batch.id,
          label: `#${batch.batch_number}`,
          subLabel: varieties?.name || undefined,
        });
      }
    }

    // Also search by variety name if we didn't find enough
    if (results.length < 10) {
      const { data: varietyBatches, error: varietyError } = await supabase
        .from("batches")
        .select(
          `
          id,
          batch_number,
          plant_varieties!inner (name)
        `
        )
        .eq("org_id", orgId)
        .neq("status", "Archived")
        .ilike("plant_varieties.name", safeIlikePattern(q))
        .limit(10 - results.length);

      if (!varietyError && varietyBatches) {
        const existingIds = new Set(results.map((r) => r.id));
        for (const batch of varietyBatches) {
          if (existingIds.has(batch.id)) continue;
          const varieties = batch.plant_varieties as { name?: string } | null;
          results.push({
            type: "batch",
            id: batch.id,
            label: `#${batch.batch_number}`,
            subLabel: varieties?.name || undefined,
          });
        }
      }
    }

    // Search locations by name
    const { data: locations, error: locError } = await supabase
      .from("nursery_locations")
      .select("id, name, nursery_site, type")
      .eq("org_id", orgId)
      .ilike("name", safeIlikePattern(q))
      .limit(10);

    if (!locError && locations) {
      for (const loc of locations) {
        results.push({
          type: "location",
          id: loc.id,
          label: loc.name,
          subLabel:
            [loc.nursery_site, loc.type].filter(Boolean).join(" - ") || undefined,
        });
      }
    }

    // Search material lots by lot_number or material name
    const { data: lots, error: lotError } = await supabase
      .from("material_lots")
      .select(
        `
        id,
        lot_number,
        materials (name)
      `
      )
      .eq("org_id", orgId)
      .or(`lot_number.ilike.${safeIlikePattern(q)}`)
      .limit(10);

    if (!lotError && lots) {
      for (const lot of lots) {
        const material = lot.materials as { name?: string } | null;
        results.push({
          type: "lot",
          id: lot.id,
          label: lot.lot_number,
          subLabel: material?.name || undefined,
        });
      }
    }

    // Also search by material name if we didn't find enough lots
    if (results.filter((r) => r.type === "lot").length < 10) {
      const { data: materialLots, error: materialLotError } = await supabase
        .from("material_lots")
        .select(
          `
          id,
          lot_number,
          materials!inner (name)
        `
        )
        .eq("org_id", orgId)
        .ilike("materials.name", safeIlikePattern(q))
        .limit(10);

      if (!materialLotError && materialLots) {
        const existingLotIds = new Set(
          results.filter((r) => r.type === "lot").map((r) => r.id)
        );
        for (const lot of materialLots) {
          if (existingLotIds.has(lot.id)) continue;
          const material = lot.materials as { name?: string } | null;
          results.push({
            type: "lot",
            id: lot.id,
            label: lot.lot_number,
            subLabel: material?.name || undefined,
          });
        }
      }
    }

    // Sort results by relevance (exact matches first)
    const lowerQ = q.toLowerCase();
    results.sort((a, b) => {
      const aExact = a.label.toLowerCase().includes(lowerQ) ? 0 : 1;
      const bExact = b.label.toLowerCase().includes(lowerQ) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;

      // Then by type: batch, location, lot
      const typeOrder = { batch: 0, location: 1, lot: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });

    // Limit total results
    return NextResponse.json(results.slice(0, 20));
  } catch (error) {
    logger.worker.error("Print search failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to search" },
      { status: 500 }
    );
  }
}
