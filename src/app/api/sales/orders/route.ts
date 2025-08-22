export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/server/utils/envelope";
import { CreateOrderSchema, type AllocatedLine } from "@/lib/sales/types";
import { allocateForProductLine } from "@/server/sales/allocation";
import { adminDb } from "@/server/db/admin";
import { getUser } from "@/server/auth/getUser";
import { nanoid } from "nanoid";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { requireRoles } from "@/server/auth/roles";

const BodySchema = CreateOrderSchema;

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return fail(401, "unauthenticated", "You must be signed in.");

    const rlKey = requestKey(req as any, user.uid);
    const { allowed } = await checkRateLimit({ key: `sales:create-order:${rlKey}`, windowMs: 10000, max: 10});
    if (!allowed) {
        return fail(429, "rate_limited", "Too many requests.");
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return fail(400, "invalid_input", "Invalid order.", parsed.error.flatten());
    }
    const input = parsed.data;

    // Allocate each line
    const allocatedLines: AllocatedLine[] = [];
    for (const line of input.lines) {
      const allocations = await allocateForProductLine({
        plantVariety: line.plantVariety,
        size: line.size,
        qty: line.qty,
      });
      allocatedLines.push({
        plantVariety: line.plantVariety,
        size: line.size,
        qty: line.qty,
        unitPrice: line.unitPrice,
        allocations,
      });
    }

    // Persist: orders + subcollection lines
    const now = new Date();
    const orderRef = adminDb.collection("sales_orders").doc();
    const orderId = orderRef.id;

    const status = "confirmed"; // MVP: confirm on create (UI can support draft later)

    await orderRef.set({
      customerId: input.customerId,
      storeId: input.storeId,
      status,
      deliveryDate: input.deliveryDate ?? null,
      shipMethod: input.shipMethod ?? null,
      notesCustomer: input.notesCustomer ?? null,
      notesInternal: input.notesInternal ?? null,
      totalsExVat: 0, vat: 0, totalsIncVat: 0,
      createdAt: now, updatedAt: now,
      createdBy: user.uid,
    });

    const linesCol = orderRef.collection("lines");
    const batchOps: Promise<any>[] = [];
    for (const l of allocatedLines) {
      const lineId = nanoid(8);
      batchOps.push(
        linesCol.doc(lineId).set({
          plantVariety: l.plantVariety,
          size: l.size,
          qty: l.qty,
          unitPrice: l.unitPrice ?? null,
          allocations: l.allocations,
          createdAt: now,
        })
      );
    }
    await Promise.all(batchOps);

    // Optional: enqueue labels (MVP prints one per unit)
    // UI will call the print route explicitly; we return summary here.
    return ok({
      orderId,
      status,
      lines: allocatedLines,
    }, 201);
  } catch (err: any) {
    console.error("[sales:orders:POST] error", err);
    return fail(500, "server_error", err?.message ?? "Unexpected error.");
  }
}

export async function GET(req: NextRequest) {
  try {
    const authz = await requireRoles(["sales:read"]);
    if (!authz.ok) return fail(authz.reason === "unauthenticated" ? 401 : 403, authz.reason, "Not allowed.");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    let q = adminDb.collection("sales_orders").orderBy("createdAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return ok({ items: data });
  } catch (e: any) {
    console.error("[sales:orders:GET]", e);
    return fail(500, "server_error", e?.message || "Unexpected");
  }
}
