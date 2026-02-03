import "server-only";
import { NextResponse } from "next/server";
import { getLightweightAuth } from "@/lib/auth/lightweight";
import { fetchProductionStatusOptions } from "@/server/production/saleable";
import { logger } from "@/server/utils/logger";

/**
 * Production Status Options API
 *
 * Returns the available production status options for the user's organization.
 * Used by the saleability wizard to populate status dropdowns.
 */
export async function GET() {
  try {
    const { orgId } = await getLightweightAuth();

    const options = await fetchProductionStatusOptions(orgId);

    return NextResponse.json(
      { options },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch status options";
    const status = /Unauthenticated|No organization/i.test(message) ? 401 : 500;
    logger.api.error("Status options fetch failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
