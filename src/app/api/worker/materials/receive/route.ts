import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { receiveMaterialLots } from "@/server/materials/lots";
import { MaterialLotUnitTypeSchema } from "@/lib/schemas/material-lots";

/**
 * Worker Materials Receive API
 *
 * Allows workers to receive materials (ad-hoc or against a PO).
 * Creates material lots with scannable barcodes.
 */

const ReceiveLotSchema = z.object({
  quantity: z.number().positive("Quantity must be positive"),
  unitType: MaterialLotUnitTypeSchema.default("box"),
  unitsPerPackage: z.number().positive().optional().nullable(),
  supplierLotNumber: z.string().max(100).optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const ReceiveRequestSchema = z.object({
  materialId: z.string().uuid("Invalid material ID"),
  locationId: z.string().uuid().optional().nullable(),
  lots: z.array(ReceiveLotSchema).min(1, "At least one lot is required"),
  notes: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const { supabase, orgId, user } = await getUserAndOrg();
    const userId = user.id;

    const body = await req.json();
    const parse = ReceiveRequestSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parse.error.flatten() },
        { status: 400 }
      );
    }

    const { materialId, locationId, lots, notes } = parse.data;

    // Receive the lots
    const createdLots = await receiveMaterialLots(
      supabase,
      orgId,
      userId,
      materialId,
      lots.map((lot) => ({
        quantity: lot.quantity,
        unitType: lot.unitType,
        unitsPerPackage: lot.unitsPerPackage ?? undefined,
        supplierLotNumber: lot.supplierLotNumber ?? undefined,
        expiryDate: lot.expiryDate ?? undefined,
        notes: lot.notes ?? undefined,
      })),
      locationId,
      notes ?? undefined
    );

    // Return created lots for label printing
    return NextResponse.json({
      success: true,
      message: `${createdLots.length} lot(s) received successfully`,
      lots: createdLots.map((lot) => ({
        id: lot.id,
        lotNumber: lot.lotNumber,
        lotBarcode: lot.lotBarcode,
        quantity: lot.currentQuantity,
        uom: lot.uom,
        unitType: lot.unitType,
      })),
    });
  } catch (error) {
    console.error("[api/worker/materials/receive] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: message || "Failed to receive materials" },
      { status: 500 }
    );
  }
}
