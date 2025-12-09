// src/app/api/sales/orders/route.ts
import { NextResponse } from "next/server";
import { CreateOrderSchema } from "@/lib/sales/types";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/server/utils/envelope";
import { createPickListFromOrder } from "@/server/sales/picking";
import { allocateForProductLine } from "@/server/sales/allocation";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail(401, "unauthenticated", "You must be signed in.");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    // Base select
    let q = supabase.from("orders")
      .select("id, customer_id, status, created_at, customers(name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status && status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return fail(400, "query_failed", error.message);

    const orders = (data ?? []).map((o: any) => ({
      id: o.id,
      customerName: o.customers?.name ?? "Unknown",
      customerId: o.customer_id ?? null,
      status: o.status ?? "draft",
      createdAt: o.created_at,
    }));

    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("[api:sales/orders][GET]", err);
    return NextResponse.json({ ok: false, error: String((err as any)?.message ?? err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail(401, "unauthenticated", "You must be signed in.");

    // Get active org
    let activeOrgId: string | null = null;
    const { data: profile } = await supabase.from('profiles').select('active_org_id').eq('id', user.id).single();
    if (profile?.active_org_id) {
      activeOrgId = profile.active_org_id;
    } else {
      const { data: membership } = await supabase.from('org_memberships').select('org_id').eq('user_id', user.id).limit(1).single();
      if (membership) activeOrgId = membership.org_id;
    }
    if (!activeOrgId) return fail(400, "no_org", "No active organization found.");

    const json = await req.json();
    const parsed = CreateOrderSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const input = parsed.data;

    // Resolve SKUs, check availability, and pre-compute allocations
    const preparedLines: {
      skuId: string;
      qty: number;
      unitPrice: number;
      vatRate: number;
      description: string;
      allocations: { batchId: string; qty: number }[];
    }[] = [];
    for (const line of input.lines) {
      // Find SKU by Variety + Size
      // We need to resolve Variety ID and Size ID first
      const { data: variety } = await supabase
        .from('plant_varieties')
        .select('id')
        .eq('name', line.plantVariety)
        .maybeSingle();
      const { data: size } = await supabase
        .from('plant_sizes')
        .select('id')
        .eq('name', line.size)
        .maybeSingle();

      if (!variety || !size) {
        return fail(400, "invalid_product", `Product not found: ${line.plantVariety} ${line.size}`);
      }

      const { data: sku } = await supabase
        .from('skus')
        .select('id')
        .eq('plant_variety_id', variety.id)
        .eq('size_id', size.id)
        .eq('org_id', activeOrgId)
        .maybeSingle();

      if (!sku) {
        return fail(400, "no_sku", `SKU not found for: ${line.plantVariety} ${line.size}`);
      }

      const allocations = await allocateForProductLine({
        plantVariety: line.plantVariety || "",
        size: line.size || "",
        qty: line.qty,
        specificBatchId: line.specificBatchId,
        gradePreference: line.gradePreference,
        preferredBatchNumbers: line.preferredBatchNumbers,
      });

      const totalAllocated = allocations.reduce((sum, a) => sum + a.qty, 0);
      if (totalAllocated < line.qty) {
        return fail(
          400,
          "insufficient_stock",
          `Insufficient stock for ${line.plantVariety} (${line.size}). Requested ${line.qty}, available ${totalAllocated}`
        );
      }

      preparedLines.push({
        skuId: sku.id,
        qty: line.qty,
        unitPrice: line.unitPrice ?? 0, // Should fetch from price list or SKU default
        vatRate: line.vatRate ?? 13.5, // Default
        description: line.description ?? `${line.plantVariety} - ${line.size}`,
        allocations,
      });
    }

    // Prepare lines for RPC call
    const orderNumber = `ORD-${Date.now()}`;
    const rpcLines = preparedLines.map(line => ({
      sku_id: line.skuId,
      quantity: line.qty,
      unit_price: line.unitPrice,
      vat_rate: line.vatRate,
      description: line.description,
      allocations: line.allocations.map(a => ({
        batch_id: a.batchId,
        qty: a.qty,
      })),
    }));

    // Create order atomically with row-level locking to prevent race conditions
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
      "create_order_with_allocations",
      {
        p_org_id: activeOrgId,
        p_customer_id: input.customerId,
        p_order_number: orderNumber,
        p_lines: rpcLines,
        p_requested_delivery_date: input.deliveryDate ?? null,
        p_notes: input.notesCustomer ?? input.notesInternal ?? null,
      }
    );

    if (rpcErr) {
      console.error("[api:sales/orders][POST] RPC error:", rpcErr);
      // Parse specific error messages for better UX
      if (rpcErr.message.includes("Insufficient stock")) {
        return fail(400, "insufficient_stock", rpcErr.message);
      }
      if (rpcErr.message.includes("not found")) {
        return fail(400, "not_found", rpcErr.message);
      }
      throw new Error(`Order creation failed: ${rpcErr.message}`);
    }

    const orderId = (rpcResult as { order_id: string })?.order_id;
    if (!orderId) throw new Error("Order creation failed: missing order ID");

    // Auto-create pick list for confirmed orders (so they appear in dispatch/picking queue)
    try {
      await createPickListFromOrder(orderId);
    } catch (e) {
      console.error('Failed to create pick list:', e);
      // Don't fail the order creation if pick list fails
    }

    return NextResponse.json({ ok: true, id: orderId }, { status: 201 });
  } catch (err) {
    console.error("[api:sales/orders][POST]", err);
    return NextResponse.json({ ok: false, error: "Failed to create order" }, { status: 500 });
  }
}
