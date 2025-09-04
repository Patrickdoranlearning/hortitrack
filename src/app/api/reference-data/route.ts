// app/api/reference-data/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Variety = {
  id: string;
  name: string;
  family: string | null;
  genus: string | null;
  species: string | null;
  category: string | null;
};

type PlantSize = {
  id: string;
  name: string;
  container_type: string;
  cell_multiple: number;
};

type NurseryLocation = {
  id: string;
  name: string;
  nursery_site: string;
};

type Supplier = {
  id: string;
  name: string;
  producer_code: string | null;
  country_code: string;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  // NOTE: service role is server-only. Do not import this client on the client side.
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const supabase = getAdminClient();
  // Fetch in parallel; return a narrow, safe shape.
  const [
    varietiesRes,
    sizesRes,
    locationsRes,
    suppliersRes,
  ] = await Promise.all([
    supabase
      .from("plant_varieties")
      .select("id,name,family,genus,species,category")
      .order("name", { ascending: true }),
    supabase
      .from("plant_sizes")
      .select("id,name,container_type,cell_multiple")
      .order("name", { ascending: true }),
    supabase
      .from("nursery_locations")
      .select("id,name,nursery_site")
      .order("name", { ascending: true }),
    supabase
      .from("suppliers")
      .select("id,name,producer_code,country_code")
      .order("name", { ascending: true }),
  ]);

  const errors = [
    varietiesRes.error,
    sizesRes.error,
    locationsRes.error,
    suppliersRes.error,
  ].filter(Boolean);

  if (errors.length) {
    // Return partial data with detailed error strings
    const detail = errors.map((e: any) => ({
      message: e?.message,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
    }));
    return NextResponse.json(
      {
        ok: false,
        errors: detail,
        varieties: varietiesRes.data ?? [],
        sizes: sizesRes.data ?? [],
        locations: locationsRes.data ?? [],
        suppliers: suppliersRes.data ?? [],
      },
      { status: 207 } // Multi-Status: partial failure but usable payload
    );
  }

  return NextResponse.json(
    {
      ok: true,
      errors: [],
      varieties: (varietiesRes.data ?? []) as Variety[],
      sizes: (sizesRes.data ?? []) as PlantSize[],
      locations: (locationsRes.data ?? []) as NurseryLocation[],
      suppliers: (suppliersRes.data ?? []) as Supplier[],
    },
    { status: 200 }
  );
}
