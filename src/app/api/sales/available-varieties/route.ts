import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseServerApp } from "@/server/db/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const { data, error } = await supabase
      .from("product_batches")
      .select(
        `
          batch_id,
          batches (
            id,
            quantity,
            reserved_quantity,
            plant_variety_id,
            plant_varieties ( id, name )
          )
        `
      )
      .eq("org_id", orgId)
      .eq("product_id", productId);

    if (error) {
      console.error("[available-varieties] query error", error);
      return NextResponse.json({ error: "Failed to load varieties" }, { status: 500 });
    }

    const aggregates = new Map<
      string,
      { id: string; name: string | null; availableQty: number }
    >();

    (data || []).forEach((row) => {
      const varietyId = row.batches?.plant_variety_id;
      const varietyName = row.batches?.plant_varieties?.name ?? null;
      if (!varietyId) return;

      const available =
        (row.batches?.quantity ?? 0) - (row.batches?.reserved_quantity ?? 0);

      if (!aggregates.has(varietyId)) {
        aggregates.set(varietyId, { id: varietyId, name: varietyName, availableQty: 0 });
      }
      const agg = aggregates.get(varietyId)!;
      agg.availableQty += available > 0 ? available : 0;
    });

    return NextResponse.json({
      varieties: Array.from(aggregates.values()).filter((v) => v.availableQty > 0),
    });
  } catch (err) {
    console.error("[available-varieties] unexpected error", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}







