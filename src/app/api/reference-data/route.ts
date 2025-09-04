
// src/app/api/reference-data/route.ts
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

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // Make this loud and obvious in responses — anon key would trigger RLS/policy recursion
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    const supabase = getClient();
    // Fetch in parallel; return a narrow, safe shape.
    const [varietiesRes, sizesRes, locationsRes, suppliersRes] = await Promise.all([
      // IMPORTANT: DB column is "Category" (case-sensitive), not "category"
      supabase.from("plant_varieties").select('id,name,family,genus,species,"Category"').order("name", { ascending: true }),
      supabase.from("plant_sizes").select("id,name,container_type,cell_multiple").order("name", { ascending: true }),
      supabase.from("nursery_locations").select("id,name,nursery_site").order("name", { ascending: true }),
      supabase.from("suppliers").select("id,name,producer_code,country_code").order("name", { ascending: true }),
    ]);

    const errors = [varietiesRes.error, sizesRes.error, locationsRes.error, suppliersRes.error].filter(Boolean);

    if (errors.length) {
      const detail = errors.map((e: any) => ({
        message: e?.message ?? String(e),
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
        { status: 207 }
      );
    }

    // Map "Category" -> category for consistency
    const varieties = (varietiesRes.data ?? []).map((v: any) => ({
      id: v.id,
      name: v.name,
      family: v.family ?? null,
      genus: v.genus ?? null,
      species: v.species ?? null,
      category: v["Category"] ?? null,
    }));

    return NextResponse.json(
      {
        ok: true,
        errors: [],
        varieties,
        sizes: (sizesRes.data ?? []) as PlantSize[],
        locations: (locationsRes.data ?? []) as NurseryLocation[],
        suppliers: (suppliersRes.data ?? []) as Supplier[],
      },
      { status: 200 }
    );
  } catch (err: any) {
    // Never return a blank 500 — include a JSON message for the client
    return NextResponse.json(
      { ok: false, errors: [{ message: err?.message ?? "unknown server error" }] },
      { status: 500 }
    );
  }
}
