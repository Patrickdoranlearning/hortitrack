import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import {
  getMaterialLot,
  adjustLotQuantity,
  transferLot,
  scrapLot,
  getLotTransactions,
} from "@/server/materials/lots";
import {
  AdjustLotSchema,
  TransferLotSchema,
  ScrapLotSchema,
  UpdateLotStatusSchema,
} from "@/lib/schemas/material-lots";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/materials/lots/[id]
 * Get a single lot with details
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const includeTransactions = searchParams.get("includeTransactions") === "true";

    const lot = await getMaterialLot(supabase, orgId, id);

    if (!lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    let transactions = undefined;
    if (includeTransactions) {
      const txnResult = await getLotTransactions(supabase, orgId, id, { limit: 50 });
      transactions = txnResult.transactions;
    }

    return NextResponse.json({ lot, transactions });
  } catch (error: unknown) {
    console.error("[lot GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch lot";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PATCH /api/materials/lots/[id]
 * Update lot (adjust quantity, transfer, or update status)
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { supabase, orgId, user } = await getUserAndOrg();
    const { id } = await params;

    // Rate limit
    const rlKey = `lots:update:${requestKey(req, user.id)}`;
    const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 100 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests", resetMs: rl.resetMs }, { status: 429 });
    }

    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case "adjust": {
        const parsed = AdjustLotSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid request body", issues: parsed.error.format() },
            { status: 400 }
          );
        }

        const lot = await adjustLotQuantity(supabase, orgId, user.id, id, {
          lotId: id,
          quantity: parsed.data.quantity,
          reason: parsed.data.reason,
          notes: parsed.data.notes ?? undefined,
        });

        return NextResponse.json({ lot });
      }

      case "transfer": {
        const parsed = TransferLotSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid request body", issues: parsed.error.format() },
            { status: 400 }
          );
        }

        const lot = await transferLot(supabase, orgId, user.id, id, {
          lotId: id,
          toLocationId: parsed.data.toLocationId,
          notes: parsed.data.notes ?? undefined,
        });

        return NextResponse.json({ lot });
      }

      case "scrap": {
        const parsed = ScrapLotSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid request body", issues: parsed.error.format() },
            { status: 400 }
          );
        }

        const lot = await scrapLot(
          supabase,
          orgId,
          user.id,
          id,
          parsed.data.reason,
          parsed.data.notes ?? undefined
        );

        return NextResponse.json({ lot });
      }

      case "updateStatus": {
        const parsed = UpdateLotStatusSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid request body", issues: parsed.error.format() },
            { status: 400 }
          );
        }

        // Update status directly
        const { error } = await supabase
          .from("material_lots")
          .update({
            status: parsed.data.status,
            notes: parsed.data.notes ?? undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("org_id", orgId);

        if (error) {
          throw new Error(`Failed to update status: ${error.message}`);
        }

        const lot = await getMaterialLot(supabase, orgId, id);
        return NextResponse.json({ lot });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: adjust, transfer, scrap, or updateStatus" },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error("[lot PATCH] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to update lot";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
