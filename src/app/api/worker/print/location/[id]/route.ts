import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

/**
 * Worker Location Print Data API
 *
 * Returns location information needed for label printing.
 * Includes summary of batches at this location.
 */

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

interface BatchSummary {
  id: string;
  batchNumber: string;
  varietyName: string | null;
  quantity: number;
}

interface LocationPrintData {
  id: string;
  name: string;
  nurserySite: string | null;
  type: string | null;
  covered: boolean;
  batchCount: number;
  totalQuantity: number;
  batches: BatchSummary[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const parse = ParamsSchema.safeParse(resolvedParams);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid location ID" },
        { status: 400 }
      );
    }

    const { id: locationId } = parse.data;
    const { supabase, orgId } = await getUserAndOrg();

    // Fetch location details
    const { data: location, error: locError } = await supabase
      .from("nursery_locations")
      .select("id, name, nursery_site, type, covered")
      .eq("id", locationId)
      .eq("org_id", orgId)
      .single();

    if (locError || !location) {
      if (locError?.code === "PGRST116") {
        return NextResponse.json(
          { error: "Location not found" },
          { status: 404 }
        );
      }
      logger.worker.error("Location print data query failed", locError);
      return NextResponse.json(
        { error: "Failed to fetch location" },
        { status: 500 }
      );
    }

    // Fetch batches at this location
    const { data: batches, error: batchError } = await supabase
      .from("batches")
      .select(
        `
        id,
        batch_number,
        quantity,
        plant_varieties (name)
      `
      )
      .eq("org_id", orgId)
      .eq("location_id", locationId)
      .neq("status", "Archived")
      .gt("quantity", 0)
      .order("batch_number", { ascending: false });

    if (batchError) {
      logger.worker.error("Location print batches query failed", batchError);
      return NextResponse.json(
        { error: "Failed to fetch batches" },
        { status: 500 }
      );
    }

    // Transform batches
    const batchSummaries: BatchSummary[] = (batches ?? []).map((b) => {
      const varieties = b.plant_varieties as { name?: string } | null;
      return {
        id: b.id,
        batchNumber: b.batch_number,
        varietyName: varieties?.name ?? null,
        quantity: b.quantity ?? 0,
      };
    });

    const result: LocationPrintData = {
      id: location.id,
      name: location.name,
      nurserySite: location.nursery_site,
      type: location.type,
      covered: location.covered ?? false,
      batchCount: batchSummaries.length,
      totalQuantity: batchSummaries.reduce((sum, b) => sum + b.quantity, 0),
      batches: batchSummaries,
    };

    return NextResponse.json(result);
  } catch (error) {
    logger.worker.error("Location print failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to load location" },
      { status: 500 }
    );
  }
}
