export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/server/db/supabaseAdmin";
import { ok, fail } from "@/server/utils/envelope";
import { requireRoles } from "@/server/auth/roles";
import { OrderStatus, canTransition } from "@/server/sales/status";

export async function GET(_: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const authz = await requireRoles(["sales:read"]);
    if (!authz.ok) return fail(authz.reason === "unauthenticated" ? 401 : 403, authz.reason, "Not allowed.");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("sales_orders")
      .select("*")
      .eq("id", params.orderId)
      .single();

    if (orderErr || !order) return fail(404, "not_found", "Order not found.");

    const { data: lines, error: linesErr } = await supabaseAdmin
      .from("sales_order_lines")
      .select("*")
      .eq("order_id", params.orderId);

    if (linesErr) console.error("Error fetching lines:", linesErr);

    return ok({ ...order, lines: lines || [] });
  } catch (e: any) {
    console.error("[sales:order:GET]", e);
    return fail(500, "server_error", e?.message || "Unexpected");
  }
}

const PatchSchema = z.object({
  action: z.literal("set_status"),
  status: OrderStatus,
});

export async function PATCH(req: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const authz = await requireRoles(["sales:update", "sales:read"]);
    if (!authz.ok) return fail(authz.reason === "unauthenticated" ? 401 : 403, authz.reason, "Not allowed.");

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return fail(400, "invalid_input", "Invalid payload.", parsed.error.flatten());

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("sales_orders")
      .select("status")
      .eq("id", params.orderId)
      .single();

    if (orderErr || !order) return fail(404, "not_found", "Order not found.");

    const current = String(order.status || "draft") as any;
    const target = parsed.data.status;

    if (!canTransition(current, target)) {
      return fail(400, "invalid_transition", `Cannot move from ${current} to ${target}.`);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sales_orders")
      .update({ status: target, updated_at: new Date().toISOString() })
      .eq("id", params.orderId);

    if (updateErr) throw new Error(updateErr.message);

    console.info("[sales:order:PATCH] status", { id: params.orderId, from: current, to: target });
    return ok({ id: params.orderId, status: target });
  } catch (e: any) {
    console.error("[sales:order:PATCH]", e);
    return fail(500, "server_error", e?.message || "Unexpected");
  }
}
