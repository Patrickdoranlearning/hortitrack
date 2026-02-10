export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/server/utils/envelope";
import { requireRoles } from "@/server/auth/roles";
import { OrderStatus, canTransition } from "@/server/sales/status";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const authz = await requireRoles(["sales:read"]);
    if (!authz.ok) return fail(authz.reason === "unauthenticated" ? 401 : 403, authz.reason, "Not allowed.");

    // Get org context to ensure multi-tenant isolation
    const { supabase, orgId } = await getUserAndOrg();

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("org_id", orgId) // SECURITY: Enforce org_id filter for multi-tenant isolation
      .single();

    if (orderErr || !order) return fail(404, "not_found", "Order not found.");

    const { data: lines, error: linesErr } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (linesErr) logger.sales.error("Error fetching order lines", linesErr);

    return ok({ ...order, lines: lines || [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return fail(401, "unauthenticated", "Not authenticated.");
    }
    logger.sales.error("GET /api/sales/orders/[orderId] failed", e);
    return fail(500, "server_error", message || "Unexpected");
  }
}

const PatchSchema = z.object({
  action: z.literal("set_status"),
  status: OrderStatus,
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const authz = await requireRoles(["sales:update", "sales:read"]);
    if (!authz.ok) return fail(authz.reason === "unauthenticated" ? 401 : 403, authz.reason, "Not allowed.");

    // Get org context to ensure multi-tenant isolation
    const { supabase, orgId } = await getUserAndOrg();

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return fail(400, "invalid_input", "Invalid payload.", parsed.error.flatten());

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .eq("org_id", orgId) // SECURITY: Enforce org_id filter for multi-tenant isolation
      .single();

    if (orderErr || !order) return fail(404, "not_found", "Order not found.");

    const current = String(order.status || "draft") as OrderStatus;
    const target = parsed.data.status;

    if (!canTransition(current, target)) {
      return fail(400, "invalid_transition", `Cannot move from ${current} to ${target}.`);
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update({ status: target, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("org_id", orgId); // SECURITY: Enforce org_id filter on update too

    if (updateErr) throw new Error(updateErr.message);

    logger.sales.info("Order status updated", { orderId, from: current, to: target });
    return ok({ id: orderId, status: target });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return fail(401, "unauthenticated", "Not authenticated.");
    }
    logger.sales.error("PATCH /api/sales/orders/[orderId] failed", e);
    return fail(500, "server_error", message || "Unexpected");
  }
}
