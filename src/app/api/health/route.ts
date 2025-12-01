export const runtime = "nodejs";

import { NextResponse } from "next/server";
// import { supabaseAdmin } from "@/server/db/supabaseAdmin"; // Optional if we want to check DB connectivity

export async function GET() {
  const checks: Record<string, unknown> = {
    ok: true,
  };
  try {
    // lightweight read (no writes)
    // await supabaseAdmin.from('batches').select('id').limit(1);
    checks.supabase = "ok";
  } catch (e: any) {
    checks.supabase = `error: ${e?.message || e}`;
  }
  return NextResponse.json(checks, { status: 200 });
}
