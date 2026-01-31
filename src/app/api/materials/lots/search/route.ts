import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import {
  getMaterialLotByNumber,
  getMaterialLotByBarcode,
  listMaterialLots,
} from "@/server/materials/lots";
import { parseLotScanCode } from "@/lib/scan/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/materials/lots/search
 * Search lots by lot number, barcode, or text
 */
export async function GET(req: Request) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { searchParams } = new URL(req.url);

    const query = searchParams.get("q") || searchParams.get("query");
    const materialId = searchParams.get("materialId");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    // Try to parse as a lot scan code first
    const parsed = parseLotScanCode(query);

    if (parsed) {
      let lot = null;

      if (parsed.by === "lotNumber") {
        lot = await getMaterialLotByNumber(supabase, orgId, parsed.value);
      } else if (parsed.by === "lotBarcode") {
        lot = await getMaterialLotByBarcode(supabase, orgId, parsed.value);
      }

      if (lot) {
        // If materialId filter provided, check it matches
        if (materialId && lot.materialId !== materialId) {
          return NextResponse.json({
            lots: [],
            message: "Lot found but belongs to different material",
          });
        }

        return NextResponse.json({ lots: [lot] });
      }
    }

    // Fall back to text search
    const { lots } = await listMaterialLots(supabase, orgId, {
      filters: {
        materialId: materialId ?? undefined,
        search: query,
        hasStock: true,
      },
      sortField: "receivedAt",
      sortOrder: "asc",
      limit: 20,
    });

    return NextResponse.json({ lots });
  } catch (error: unknown) {
    console.error("[lots/search GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to search lots";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
