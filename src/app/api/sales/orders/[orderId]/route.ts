export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import { ok, fail } from "@/server/utils/envelope";
import { requireRoles } from "@/server/auth/roles";
import { OrderStatus, canTransition } from "@/server/sales/status";

export async function GET(_: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const authz = await requireRoles(["sales:read"]);
    if (!authz.ok) return fail(authz.reason === "unauthenticated" ? 401 : 403, authz.reason, "Not allowed.");

    const ref = adminDb.collection("sales_orders").doc(params.orderId);
    const doc = await ref.get();
    if (!doc.exists) return fail(404, "not_found", "Order not found.");

    const linesSnap = await ref.collection("lines").get();
    const lines = linesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    return ok({ id: doc.id, ...doc.data(), lines });
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

    const ref = adminDb.collection("sales_orders").doc(params.orderId);
    const doc = await ref.get();
    if (!doc.exists) return fail(404, "not_found", "Order not found.");

    const current = String((doc.data() as any).status || "draft") as any;
    const target = parsed.data.status;

    if (!canTransition(current, target)) {
      return fail(400, "invalid_transition", `Cannot move from ${current} to ${target}.`);
    }

    await ref.update({ status: target, updatedAt: new Date() });
    console.info("[sales:order:PATCH] status", { id: params.orderId, from: current, to: target });
    return ok({ id: params.orderId, status: target });
  } catch (e: any) {
    console.error("[sales:order:PATCH]", e);
    return fail(500, "server_error", e?.message || "Unexpected");
  }
}
