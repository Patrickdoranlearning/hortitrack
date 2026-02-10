import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

/**
 * Worker Batch Print Data API
 *
 * Returns batch information needed for label printing.
 */

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

interface BatchPrintData {
  id: string;
  batchNumber: string;
  varietyName: string | null;
  familyName: string | null;
  sizeName: string | null;
  locationName: string | null;
  quantity: number;
  plantedAt: string | null;
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
        { error: "Invalid batch ID" },
        { status: 400 }
      );
    }

    const { id: batchId } = parse.data;
    const { supabase, orgId } = await getUserAndOrg();

    const { data, error } = await supabase
      .from("batches")
      .select(
        `
        id,
        batch_number,
        quantity,
        planted_at,
        plant_varieties (
          name,
          family
        ),
        plant_sizes (
          name
        ),
        nursery_locations (
          name
        )
      `
      )
      .eq("id", batchId)
      .eq("org_id", orgId)
      .single();

    if (error || !data) {
      if (error?.code === "PGRST116") {
        return NextResponse.json(
          { error: "Batch not found" },
          { status: 404 }
        );
      }
      logger.worker.error("Batch print data query failed", error);
      return NextResponse.json(
        { error: "Failed to fetch batch" },
        { status: 500 }
      );
    }

    const varieties = data.plant_varieties as { name?: string; family?: string } | null;
    const sizes = data.plant_sizes as { name?: string } | null;
    const locations = data.nursery_locations as { name?: string } | null;

    const result: BatchPrintData = {
      id: data.id,
      batchNumber: data.batch_number,
      varietyName: varieties?.name ?? null,
      familyName: varieties?.family ?? null,
      sizeName: sizes?.name ?? null,
      locationName: locations?.name ?? null,
      quantity: data.quantity ?? 0,
      plantedAt: data.planted_at,
    };

    return NextResponse.json(result);
  } catch (error) {
    logger.worker.error("Batch print failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to load batch" },
      { status: 500 }
    );
  }
}
