// src/app/api/sales/orders/route.ts
import { NextResponse } from "next/server";
import { CreateOrderSchema } from "@/lib/sales/types";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/server/utils/envelope";

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

    // Resolve SKUs and check availability
    const linesToInsert: any[] = [];
    for (const line of input.lines) {
      // Find SKU by Variety + Size
      // We need to resolve Variety ID and Size ID first
      const { data: variety } = await supabase.from('plant_varieties').select('id').eq('name', line.plantVariety).single();
      const { data: size } = await supabase.from('plant_sizes').select('id').eq('name', line.size).single();

      if (!variety || !size) {
        return fail(400, "invalid_product", `Product not found: ${line.plantVariety} ${line.size}`);
      }

      const { data: sku } = await supabase
        .from('skus')
        .select('id')
        .eq('plant_variety_id', variety.id)
        .eq('size_id', size.id)
        .eq('org_id', activeOrgId)
        .single();

      if (!sku) {
        return fail(400, "no_sku", `SKU not found for: ${line.plantVariety} ${line.size}`);
      }

      // Optional: Check availability using allocateForProductLine (just for validation)
      // const allocations = await allocateForProductLine({ ... });
      // if (allocations.reduce((sum, a) => sum + a.qty, 0) < line.qty) ...

      linesToInsert.push({
        sku_id: sku.id,
        quantity: line.qty,
        unit_price_ex_vat: line.unitPrice ?? 0, // Should fetch from price list or SKU default
        vat_rate: 13.5, // Default
        description: `${line.plantVariety} - ${line.size}`,
      });
    }

    // Create Order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        org_id: activeOrgId,
        customer_id: input.customerId,
        // store_id: input.storeId, // Not in new schema?
        order_number: `ORD-${Date.now()}`,
        status: "confirmed", // MVP
        requested_delivery_date: input.deliveryDate ?? null,
        // ship_method: input.shipMethod ?? null, // Not in new schema?
        notes: input.notesCustomer ?? input.notesInternal ?? null,
        subtotal_ex_vat: 0, // Calculate?
        vat_amount: 0,
        total_inc_vat: 0,
      })
      .select("id")
      .single();

    if (orderErr) throw new Error(`Order create failed: ${orderErr.message}`);
    const orderId = order.id;

    // Insert Lines
    const { error: linesErr } = await supabase
      .from("order_items")
      .insert(linesToInsert.map(l => ({ ...l, order_id: orderId })));

    if (linesErr) throw new Error(`Lines create failed: ${linesErr.message}`);

    return NextResponse.json({ ok: true, id: orderId }, { status: 201 });
  } catch (err) {
    console.error("[api:sales/orders][POST]", err);
    return NextResponse.json({ ok: false, error: "Failed to create order" }, { status: 500 });
  }
}
