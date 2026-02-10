// src/app/api/sales/products/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { logger } from "@/server/utils/logger";

export async function GET() {
  try {
    const supabase = await getSupabaseServerApp();
    const { data, error } = await supabase
      .from("v_sku_available")
      .select("sku_code, description, available_qty")
      .order("sku_code");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    const products = (data ?? []).map(r => ({
      id: r.sku_code,
      plantVariety: r.description ?? r.sku_code,
      size: "",                    // optional until sizes joined
      category: "General",         // placeholder (no category in view)
      totalQuantity: Number(r.available_qty ?? 0),
      barcode: r.sku_code,
      cost: 0,
      status: (Number(r.available_qty ?? 0) > 0) ? "Available" : "Out",
      imageUrl: null,
      availableBatches: [],
    }));
    return NextResponse.json({ ok: true, products });
  } catch (e) {
    logger.sales.error("GET /api/sales/products failed", e);
    return NextResponse.json({ ok: false, error: "Failed to fetch products" }, { status: 500 });
  }
}
