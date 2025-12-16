import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  calculateTrolleysNeeded,
  getRemainingCapacitySuggestions,
  type OrderLineForCalculation,
} from "@/lib/dispatch/trolley-calculation";
import {
  getTrolleyCapacityConfigs,
  getShelfQuantitiesForSizes,
  getPlantSizesWithShelfQuantity,
} from "@/server/dispatch/trolley-capacity.server";

// ================================================
// VALIDATION SCHEMAS
// ================================================

const lineSchema = z.object({
  sizeId: z.string(),
  family: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  // Optional: if provided, skips lookup
  shelfQuantity: z.number().int().positive().optional(),
});

const calculateSchema = z.object({
  lines: z.array(lineSchema).min(1),
  // If true, include suggestions for what else fits
  includeSuggestions: z.boolean().optional(),
});

// ================================================
// POST - Calculate trolleys needed for order lines
// ================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = calculateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { lines, includeSuggestions } = parsed.data;

    // Get capacity configs
    const configs = await getTrolleyCapacityConfigs();

    // Get shelf quantities for sizes that don't have them provided
    const sizeIdsNeedingLookup = lines
      .filter((l) => l.shelfQuantity === undefined)
      .map((l) => l.sizeId);

    const shelfQuantityMap =
      sizeIdsNeedingLookup.length > 0
        ? await getShelfQuantitiesForSizes([...new Set(sizeIdsNeedingLookup)])
        : new Map<string, number>();

    // Build calculation input
    const calculationLines: OrderLineForCalculation[] = lines.map((line) => ({
      sizeId: line.sizeId,
      family: line.family ?? null,
      quantity: line.quantity,
      shelfQuantity:
        line.shelfQuantity ?? shelfQuantityMap.get(line.sizeId) ?? 1,
    }));

    // Calculate trolleys
    const result = calculateTrolleysNeeded(calculationLines, configs);

    // Optionally get suggestions for remaining capacity
    let suggestions: Array<{
      sizeName: string;
      sizeId: string;
      shelvesCanFit: number;
      unitsCanFit: number;
    }> = [];

    if (includeSuggestions && result.holesRemaining > 0) {
      const allSizes = await getPlantSizesWithShelfQuantity();
      const availableSizes = allSizes.map((s) => ({
        sizeId: s.id,
        sizeName: s.name,
        shelfQuantity: s.shelfQuantity ?? 1,
      }));

      // Use the most common family from the order for context
      const familyCounts = new Map<string, number>();
      for (const line of lines) {
        if (line.family) {
          familyCounts.set(
            line.family,
            (familyCounts.get(line.family) || 0) + 1
          );
        }
      }
      const dominantFamily =
        familyCounts.size > 0
          ? [...familyCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
          : null;

      suggestions = getRemainingCapacitySuggestions(
        result.holesRemaining,
        availableSizes,
        configs,
        dominantFamily
      );
    }

    return NextResponse.json({
      ok: true,
      totalTrolleys: result.totalTrolleys,
      totalHolesUsed: result.totalHolesUsed,
      currentTrolleyHolesUsed: result.currentTrolleyHolesUsed,
      holesRemaining: result.holesRemaining,
      breakdown: result.breakdown,
      suggestions: includeSuggestions ? suggestions : undefined,
    });
  } catch (error) {
    console.error("[POST trolley-calculation] error:", error);
    return NextResponse.json(
      { ok: false, error: "Calculation failed" },
      { status: 500 }
    );
  }
}
