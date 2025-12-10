import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

type SummaryResponse = {
  batch: {
    id: string;
    batch_number: string;
    phase: string | null;
    status: string | null;
    quantity: number | null;
    planted_at: string | null;
    location_id: string | null;
    location_name: string | null;
    location_site: string | null;
    size_id: string | null;
    size_name: string | null;
    size_container_type: string | null;
    size_cell_multiple: number | null;
    variety_name: string | null;
    variety_family: string | null;
  } | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = id;
  try {
    const { supabase } = await getUserAndOrg();
    const { data, error } = await supabase
      .from("batches")
      .select(
        `
        id,
        org_id,
        batch_number,
        phase,
        status,
        quantity,
        planted_at,
        location_id,
        size_id,
        plant_variety_id,
        location:location_id (id, name, nursery_site),
        size:size_id (id, name, container_type, cell_multiple),
        variety:plant_variety_id (id, name, family)
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: "Batch not found", requestId },
        { status: 404 }
      );
    }

    const summary: SummaryResponse["batch"] = {
      id: data.id,
      batch_number: data.batch_number,
      phase: (data as any).phase ?? null,
      status: (data as any).status ?? null,
      quantity: (data as any).quantity ?? null,
      planted_at: (data as any).planted_at ?? null,
      location_id: data.location_id ?? null,
      location_name: (data as any).location?.name ?? null,
      location_site: (data as any).location?.nursery_site ?? null,
      size_id: data.size_id ?? null,
      size_name: (data as any).size?.name ?? null,
      size_container_type: (data as any).size?.container_type ?? null,
      size_cell_multiple: (data as any).size?.cell_multiple ?? null,
      variety_name: (data as any).variety?.name ?? null,
      variety_family: (data as any).variety?.family ?? null,
    };

    return NextResponse.json({ batch: summary } satisfies SummaryResponse, {
      status: 200,
    });
  } catch (e: any) {
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 500;
    return NextResponse.json(
      {
        error: e?.message ?? "Server error",
        requestId,
      },
      { status }
    );
  }
}

