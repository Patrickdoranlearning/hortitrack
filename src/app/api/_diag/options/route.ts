import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Node runtime makes dev more predictable
export const dynamic = "force-dynamic";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  // Plain client (no cookies) to avoid SSR auth stalls in dev
  return createClient(url, anon, { auth: { persistSession: false } });
}

export async function GET() {
  // Disable diagnostic endpoints in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const s = client();
  const started = Date.now();

  const out: any = { ok: true, elapsedMs: 0, whoami: null, counts: {}, samples: {}, errors: {} };

  const userRes = await s.auth.getUser().catch(e => ({ error: e }));
  out.whoami = userRes?.data?.user ?? null;

  // Helper to measure a table quickly
  async function probe(name: string, q: any) {
    const t0 = Date.now();
    try {
      const { data, error } = await q.limit(1);
      if (error) {
        out.errors[name] = error.message ?? String(error);
        out.counts[name] = null;
        out.samples[name] = null;
      } else {
        out.counts[name] = Array.isArray(data) ? data.length : 0; // 0 or 1
        out.samples[name] = data?.[0] ?? null;
      }
      out[`ms_${name}`] = Date.now() - t0;
    } catch (e: any) {
      out.errors[name] = e?.message ?? String(e);
      out.counts[name] = null;
      out.samples[name] = null;
      out[`ms_${name}`] = Date.now() - t0;
    }
  }

  // Global lookup tables (should return even without org)
  await probe("plant_sizes", s.from("plant_sizes").select("id,name,container_type,cell_multiple").order("name"));
  await probe("plant_varieties", s.from("plant_varieties").select("id,name,family,genus,species").order("name"));

  // Org-scoped tables (RLS will restrict unless membership exists)
  await probe("sites", s.from("sites").select("id,name,org_id").order("name"));
  await probe("nursery_locations", s.from("nursery_locations").select("id,name,site_id,org_id").order("name"));

  out.elapsedMs = Date.now() - started;

  return NextResponse.json(out, { status: 200 });
}