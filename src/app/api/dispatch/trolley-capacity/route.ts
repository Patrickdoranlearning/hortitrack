import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getTrolleyCapacityRecords,
  upsertTrolleyCapacity,
  deleteTrolleyCapacity,
  getDistinctFamilies,
  getPlantSizesWithShelfQuantity,
} from "@/server/dispatch/trolley-capacity.server";

// ================================================
// VALIDATION SCHEMAS
// ================================================

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  family: z.string().nullable().optional(),
  sizeId: z.string().uuid().nullable().optional(),
  shelvesPerTrolley: z.number().int().min(1).max(16),
  notes: z.string().nullable().optional(),
});

// ================================================
// GET - List all trolley capacity configs + reference data
// ================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeRefData = searchParams.get("includeRefData") === "true";

    const configs = await getTrolleyCapacityRecords();

    if (includeRefData) {
      // Include reference data for the admin UI
      const [families, sizes] = await Promise.all([
        getDistinctFamilies(),
        getPlantSizesWithShelfQuantity(),
      ]);

      return NextResponse.json({
        ok: true,
        configs,
        families,
        sizes,
      });
    }

    return NextResponse.json({
      ok: true,
      configs,
    });
  } catch (error) {
    console.error("[GET trolley-capacity] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch trolley capacity configs" },
      { status: 500 }
    );
  }
}

// ================================================
// POST - Create or update a trolley capacity config
// ================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = upsertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await upsertTrolleyCapacity({
      id: parsed.data.id,
      family: parsed.data.family,
      sizeId: parsed.data.sizeId,
      shelvesPerTrolley: parsed.data.shelvesPerTrolley,
      notes: parsed.data.notes,
    });

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error || "Failed to save" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
    });
  } catch (error) {
    console.error("[POST trolley-capacity] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to save trolley capacity config" },
      { status: 500 }
    );
  }
}

// ================================================
// DELETE - Remove a trolley capacity config
// ================================================

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "ID is required" },
        { status: 400 }
      );
    }

    const result = await deleteTrolleyCapacity(id);

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error || "Failed to delete" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE trolley-capacity] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete trolley capacity config" },
      { status: 500 }
    );
  }
}
