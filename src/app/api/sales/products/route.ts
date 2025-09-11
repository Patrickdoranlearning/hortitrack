// src/app/api/sales/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerWithCookies, type CookieBridge } from "@/server/db/supabaseServerApp";
import { cookies } from "next/headers";

function getSupabaseForApp() {
  const store = cookies();
  const cookieBridge: CookieBridge = {
    get: (n) => store.get(n)?.value,
    set: (n, v, o) => store.set(n, v, o),
    remove: (n, o) => store.set(n, "", { ...o, maxAge: 0 }),
  };
  return createSupabaseServerWithCookies(cookieBridge);
}

export async function GET() {
  try {
    const supabase = getSupabaseForApp();
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
    console.error("[api:sales/products][GET]", e);
    return NextResponse.json({ ok: false, error: "Failed to fetch products" }, { status: 500 });
  }
}
