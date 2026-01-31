import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getMaterialLot } from "@/server/materials/lots";
import { buildLotLabelZpl, buildCompactLotLabelZpl } from "@/server/labels/build-lot-label";
import { sendToPrinter } from "@/server/labels/send-to-printer";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PrintLotLabelSchema = z.object({
  copies: z.number().int().min(1).max(100).default(1),
  printerId: z.string().uuid().optional(),
  compact: z.boolean().default(false),
  preview: z.boolean().default(false),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/materials/lots/[id]/print
 * Print label for a material lot
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { id } = await params;

    const body = await req.json();
    const parsed = PrintLotLabelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const lot = await getMaterialLot(supabase, orgId, id);
    if (!lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Build label input
    const labelInput = {
      lotNumber: lot.lotNumber,
      lotBarcode: lot.lotBarcode,
      materialName: lot.material?.name ?? "Unknown Material",
      materialPartNumber: lot.material?.partNumber ?? "",
      categoryName: lot.material?.category?.name ?? "",
      quantity: lot.currentQuantity,
      uom: lot.uom,
      unitType: lot.unitType,
      unitsPerPackage: lot.unitsPerPackage,
      supplierName: lot.supplier?.name,
      supplierLotNumber: lot.supplierLotNumber,
      receivedDate: lot.receivedAt,
      expiryDate: lot.expiryDate,
      locationName: lot.location?.name,
    };

    // Generate ZPL
    const zpl = parsed.data.compact
      ? buildCompactLotLabelZpl(labelInput, parsed.data.copies)
      : buildLotLabelZpl(labelInput, parsed.data.copies);

    // If preview, just return the ZPL
    if (parsed.data.preview) {
      return NextResponse.json({ zpl, label: labelInput });
    }

    // Send to printer
    if (!parsed.data.printerId) {
      return NextResponse.json(
        { error: "printerId is required for printing" },
        { status: 400 }
      );
    }

    await sendToPrinter(supabase, orgId, parsed.data.printerId, zpl, {
      jobType: "lot",
      referenceId: id,
      copies: parsed.data.copies,
    });

    return NextResponse.json({
      success: true,
      message: `Label sent to printer (${parsed.data.copies} copies)`,
    });
  } catch (error: unknown) {
    console.error("[lot/print POST] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to print label";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
