import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseServerApp } from "@/server/db/supabase";

const SALEABLE_STATUSES = ["Ready", "Looking Good"] as const;

export async function GET() {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const { data, error } = await supabase
      .from("batches")
      .select(
        `
        id,
        batch_number,
        quantity,
        status,
        plant_variety_id,
        size_id,
        plant_varieties ( name ),
        plant_sizes ( name )
      `
      )
      .eq("org_id", orgId)
      .in("status", SALEABLE_STATUSES)
      .gt("quantity", 0)
      .order("batch_number", { ascending: true });

    if (error) {
      console.error("[linkable-batches] failed to load batches", error);
      return NextResponse.json(
        { error: "Unable to load saleable batches." },
        { status: 500 }
      );
    }

    const batches =
      data?.map((row) => ({
        id: row.id,
        label: `#${row.batch_number} • ${row.plant_varieties?.name ?? "Variety"} • ${
          row.plant_sizes?.name ?? "Size"
        }`,
        status: row.status ?? "",
        quantity: row.quantity ?? 0,
        varietyId: row.plant_variety_id,
        varietyName: row.plant_varieties?.name ?? null,
        sizeId: row.size_id,
        sizeName: row.plant_sizes?.name ?? null,
      })) ?? [];

    return NextResponse.json({ batches });
  } catch (err) {
    console.error("[linkable-batches] unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error while loading batches." },
      { status: 500 }
    );
  }
}

