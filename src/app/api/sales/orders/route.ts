// src/app/api/sales/orders/route.ts
import { NextResponse } from "next/server";
import { listOrders, createOrder, NewOrderSchema } from "@/server/sales/queries.server";
import { z } from "zod";
import { ok, fail } from "@/server/utils/envelope";
import { allocateForProductLine } from "@/server/sales/allocation";
import { adminDb } from "@/server/db/admin";
import { getUser } from "@/server/auth/getUser";
import { nanoid } from "nanoid";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { requireRoles } from "@/server/auth/roles";
import { CreateOrderSchema } from "@/lib/sales/types";

export async function GET(req: Request) {
  try {
    const authz = await requireRoles(["sales:read"]);
    if (!authz.ok) return fail(authz.reason === "unauthenticated" ? 401 : 403, authz.reason, "Not allowed.");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    const orders = await listOrders(limit, status || undefined);
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("[api:sales/orders][GET]", err);
    return NextResponse.json({ ok: false, error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) return fail(401, "unauthenticated", "You must be signed in.");

    const rlKey = requestKey(req as any, user.uid);
    const { allowed } = await checkRateLimit({ key: `sales:create-order:${rlKey}`, windowMs: 10000, max: 10});
    if (!allowed) {
        return fail(429, "rate_limited", "Too many requests.");
    }
    
    const json = await req.json();
    const parsed = CreateOrderSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const input = parsed.data;

    // Allocate each line
    const allocatedLines: any[] = [];
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
    
    const id = orderId;
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("[api:sales/orders][POST]", err);
    return NextResponse.json({ ok: false, error: "Failed to create order" }, { status: 500 });
  }
}
