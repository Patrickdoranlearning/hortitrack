import { NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase/client";

export async function GET() {
  try {
    const supabase = await supabaseServer();

    // Run a cheap, read-only query to prove we’re on the expected DB
    const { count, error } = await supabase
      .from("organizations")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      using: "supabase",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, // safe to show URL domain
      orgRows: error ? null : count ?? 0,
      error: error?.message ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ using: "supabase", error: e?.message ?? "unknown" }, { status: 500 });
  }
}
