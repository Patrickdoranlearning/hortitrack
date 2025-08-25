// src/app/api/sales/products/route.ts
import { NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";
import { adminDb } from "@/server/db/admin";

export async function GET() {
  try {
    if (process.env.USE_SUPABASE_READS === "1") {
      const sb = getSupabaseForRequest();
      const { data, error } = await sb
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
    }

    // Fallback: derive from Firestore batches
    const snap = await adminDb.collection("batches").get();
    const map = new Map<string, any>();
    snap.forEach(doc => {
      const b = { id: doc.id, ...(doc.data() as any) };
      const key = `${b.plantVariety ?? b.variety ?? "Unknown"}|${b.size ?? ""}`;
      const cur = map.get(key) ?? {
        id: key,
        plantVariety: b.plantVariety ?? b.variety ?? "Unknown",
        size: b.size ?? "",
        category: b.category ?? "General",
        totalQuantity: 0,
        barcode: `SKU-${key.replace(/\s+/g, "-")}`,
        cost: 0,
        status: "Available",
        imageUrl: b.growerPhotoUrl || b.salesPhotoUrl || null,
        availableBatches: [] as any[],
      };
      cur.totalQuantity += Number(b.quantity ?? 0);
      cur.availableBatches.push(b);
      map.set(key, cur);
    });
    return NextResponse.json({ ok: true, products: [...map.values()] });
  } catch (e) {
    console.error("[api:sales/products][GET]", e);
    return NextResponse.json({ ok: false, error: "Failed to fetch products" }, { status: 500 });
  }
}
