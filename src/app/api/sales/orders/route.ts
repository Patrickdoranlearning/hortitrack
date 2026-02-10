// src/app/api/sales/orders/route.ts
import { NextResponse } from "next/server";
import { CreateOrderSchema } from "@/lib/sales/types";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/server/utils/envelope";
import { createPickListFromOrder } from "@/server/sales/picking";
import { allocateForProductLine } from "@/server/sales/allocation";
import { getSaleableBatches } from "@/server/sales/inventory";
import { calculateTrolleysNeeded, type OrderLineForCalculation } from "@/lib/dispatch/trolley-calculation";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { logger } from "@/server/utils/logger";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail(401, "unauthenticated", "You must be signed in.");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    // Base select - removed count: "exact" for performance (avoids full table scan)
    let q = supabase.from("orders")
      .select("id, customer_id, status, created_at, customers(name)")
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
    logger.sales.error("GET /api/sales/orders failed", err);
    return NextResponse.json({ ok: false, error: String((err as any)?.message ?? err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail(401, "unauthenticated", "You must be signed in.");

    // Rate limit: 20 orders per minute per user (this is a heavy operation)
    const rlKey = `orders:create:${requestKey(req, user.id)}`;
    const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 20 });
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many requests", resetMs: rl.resetMs },
        { status: 429 }
      );
    }

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

    // ============================================================
    // BULK RESOLVE: Fetch all varieties, sizes, and SKUs in 3 queries
    // instead of 3*N sequential queries (N+1 elimination)
    // ============================================================

    // Extract unique variety names and size names from all lines
    const varietyNames = [...new Set(input.lines.map(l => l.plantVariety).filter(Boolean))];
    const sizeNames = [...new Set(input.lines.map(l => l.size).filter(Boolean))];

    // Parallel bulk fetch: varieties, sizes
    const [varietiesResult, sizesResult] = await Promise.all([
      supabase.from('plant_varieties').select('id, name').in('name', varietyNames),
      supabase.from('plant_sizes').select('id, name').in('name', sizeNames),
    ]);

    // Build lookup maps for O(1) access
    const varietyMap = new Map<string, string>();
    (varietiesResult.data ?? []).forEach(v => varietyMap.set(v.name, v.id));

    const sizeMap = new Map<string, string>();
    (sizesResult.data ?? []).forEach(s => sizeMap.set(s.name, s.id));

    // Validate all varieties and sizes exist before proceeding
    for (const line of input.lines) {
      if (!varietyMap.has(line.plantVariety)) {
        return fail(400, "invalid_product", `Variety not found: ${line.plantVariety}`);
      }
      if (!sizeMap.has(line.size)) {
        return fail(400, "invalid_product", `Size not found: ${line.size}`);
      }
    }

    // Build array of (variety_id, size_id) pairs for SKU lookup
    const skuLookupPairs = input.lines.map(line => ({
      varietyId: varietyMap.get(line.plantVariety)!,
      sizeId: sizeMap.get(line.size)!,
      key: `${varietyMap.get(line.plantVariety)}-${sizeMap.get(line.size)}`,
    }));

    // Bulk fetch SKUs for this org matching any of our variety/size combinations
    const uniqueVarietyIds = [...new Set(skuLookupPairs.map(p => p.varietyId))];
    const uniqueSizeIds = [...new Set(skuLookupPairs.map(p => p.sizeId))];

    const { data: skusData } = await supabase
      .from('skus')
      .select('id, plant_variety_id, size_id')
      .eq('org_id', activeOrgId)
      .in('plant_variety_id', uniqueVarietyIds)
      .in('size_id', uniqueSizeIds);

    // Build SKU lookup map: "varietyId-sizeId" -> skuId
    const skuMap = new Map<string, string>();
    (skusData ?? []).forEach(sku => {
      skuMap.set(`${sku.plant_variety_id}-${sku.size_id}`, sku.id);
    });

    // Validate all SKUs exist
    for (const line of input.lines) {
      const key = `${varietyMap.get(line.plantVariety)}-${sizeMap.get(line.size)}`;
      if (!skuMap.has(key)) {
        return fail(400, "no_sku", `SKU not found for: ${line.plantVariety} ${line.size}`);
      }
    }

    // ============================================================
    // BULK ALLOCATION: Fetch inventory ONCE, then run allocations in parallel
    // This prevents the "Parallel DoS" pattern where N order lines would
    // each trigger a separate full inventory fetch
    // ============================================================
    const fullInventory = await getSaleableBatches();

    const allocationPromises = input.lines.map(line =>
      allocateForProductLine(
        {
          plantVariety: line.plantVariety || "",
          size: line.size || "",
          qty: line.qty,
          specificBatchId: line.specificBatchId,
          gradePreference: line.gradePreference,
          preferredBatchNumbers: line.preferredBatchNumbers,
        },
        fullInventory // Pass pre-fetched inventory to avoid N redundant queries
      )
    );

    const allAllocations = await Promise.all(allocationPromises);

    // Build prepared lines with resolved SKUs and allocations
    const preparedLines: {
      skuId: string;
      qty: number;
      unitPrice: number;
      vatRate: number;
      description: string;
      allocations: { batchId: string; qty: number }[];
    }[] = [];

    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      const allocations = allAllocations[i];
      const skuKey = `${varietyMap.get(line.plantVariety)}-${sizeMap.get(line.size)}`;

      const totalAllocated = allocations.reduce((sum, a) => sum + a.qty, 0);
      if (totalAllocated < line.qty) {
        return fail(
          400,
          "insufficient_stock",
          `Insufficient stock for ${line.plantVariety} (${line.size}). Requested ${line.qty}, available ${totalAllocated}`
        );
      }

      preparedLines.push({
        skuId: skuMap.get(skuKey)!,
        qty: line.qty,
        unitPrice: line.unitPrice ?? 0,
        vatRate: line.vatRate ?? 13.5,
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
      logger.sales.error("POST /api/sales/orders RPC error", rpcErr);
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

    // Calculate and update trolleys_estimated
    try {
      // Fetch trolley capacity configs, variety families, and shelf quantities in parallel
      const [capacityResult, varietyFamilyResult, shelfQtyResult] = await Promise.all([
        supabase
          .from('trolley_capacity')
          .select('family, size_id, shelves_per_trolley')
          .eq('org_id', activeOrgId),
        supabase
          .from('plant_varieties')
          .select('id, family')
          .in('id', [...varietyMap.values()]),
        supabase
          .from('plant_sizes')
          .select('id, shelf_quantity')
          .in('id', [...sizeMap.values()]),
      ]);

      const capacityConfigs = (capacityResult.data || []).map((c: any) => ({
        family: c.family,
        sizeId: c.size_id,
        shelvesPerTrolley: c.shelves_per_trolley,
      }));

      // Build lookup maps
      const varietyFamilyMap = new Map<string, string | null>();
      (varietyFamilyResult.data || []).forEach((v: any) => varietyFamilyMap.set(v.id, v.family));

      const shelfQtyMap = new Map<string, number>();
      (shelfQtyResult.data || []).forEach((s: any) => shelfQtyMap.set(s.id, s.shelf_quantity ?? 1));

      // Build calculation lines
      const calcLines: OrderLineForCalculation[] = [];
      for (const line of input.lines) {
        const sizeId = sizeMap.get(line.size);
        const varietyId = varietyMap.get(line.plantVariety);

        if (sizeId) {
          calcLines.push({
            sizeId,
            family: varietyId ? varietyFamilyMap.get(varietyId) ?? null : null,
            quantity: line.qty,
            shelfQuantity: shelfQtyMap.get(sizeId) ?? 1,
          });
        }
      }

      if (calcLines.length > 0) {
        const trolleyResult = calculateTrolleysNeeded(calcLines, capacityConfigs);
        if (trolleyResult.totalTrolleys > 0) {
          await supabase
            .from('orders')
            .update({ trolleys_estimated: trolleyResult.totalTrolleys })
            .eq('id', orderId);
        }
      }
    } catch (trolleyErr) {
      logger.sales.warn("Failed to calculate trolleys estimate", { error: String(trolleyErr) });
      // Don't fail order creation if trolley calculation fails
    }

    // Auto-create pick list for confirmed orders (so they appear in dispatch/picking queue)
    try {
      await createPickListFromOrder(orderId);
    } catch (e) {
      logger.sales.error("Failed to create pick list for order", e);
      // Don't fail the order creation if pick list fails
    }

    return NextResponse.json({ ok: true, id: orderId }, { status: 201 });
  } catch (err) {
    logger.sales.error("POST /api/sales/orders failed", err);
    return NextResponse.json({ ok: false, error: "Failed to create order" }, { status: 500 });
  }
}
