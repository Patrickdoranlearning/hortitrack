import { NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/server/db/supabaseServer"; // Updated import

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseForRequest(); // Updated call

  try {
    const { data: dbTime, error } = await supabase.rpc("now_service_role");

    if (error) {
      console.error("[api/_debug/firebase] Supabase error:", error);
      return NextResponse.json({ db: "supabase", error: error.message }, { status: 500 });
    }
    return NextResponse.json({ db: "supabase", time: dbTime }, { status: 200 });
  } catch (e: any) {
    console.error("[api/_debug/firebase] Error:", e);
    return NextResponse.json({ db: "supabase", error: e?.message || "unknown" }, { status: 500 });
  }
}
