import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAndOrg } from "@/server/auth/org";
import { logger, getErrorMessage } from "@/server/utils/logger";

/**
 * GET /api/dispatch/trolley-reconciliation?orderId=xxx
 * Get trolley reconciliation data for an order (estimated vs actual)
 */
export async function GET(request: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    // Get order with estimated trolleys and linked pick list
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        order_number,
        trolleys_estimated,
        pick_lists (
          id,
          trolleys_used
        )
      `
      )
      .eq("id", orderId)
      .eq("org_id", orgId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const estimated = order.trolleys_estimated;
    // pick_lists is an array, get the first one (usually only one per order)
    const pickList = Array.isArray(order.pick_lists)
      ? order.pick_lists[0]
      : order.pick_lists;
    const actual = pickList?.trolleys_used ?? null;

    let variance: number | null = null;
    let variancePercent: number | null = null;

    if (estimated !== null && actual !== null) {
      variance = actual - estimated;
      variancePercent =
        estimated > 0 ? Math.round((variance / estimated) * 100) : null;
    }

    return NextResponse.json({
      reconciliation: {
        orderId: order.id,
        orderNumber: order.order_number,
        estimated,
        actual,
        variance,
        variancePercent,
      },
    });
  } catch (error) {
    logger.trolley.error("Error in trolley reconciliation route", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
