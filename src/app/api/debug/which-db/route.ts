import { NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabaseServerApp"; // Corrected import

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServerApp(); // Corrected call

  try {
    // This RPC call might need adjustment based on your actual Supabase functions
    const { data: dbTime, error } = await supabase.rpc("now"); 

    if (error) {
      console.error("[api/debug/which-db] Supabase error:", error);
      return NextResponse.json({ db: "supabase", error: error.message }, { status: 500 });
    }
    return NextResponse.json({ db: "supabase", time: dbTime }, { status: 200 });
  } catch (e: any) {
    console.error("[api/debug/which-db] Error:", e);
    return NextResponse.json({ db: "supabase", error: e?.message || "unknown" }, { status: 500 });
  }
}
