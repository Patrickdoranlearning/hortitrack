
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Simple query to check connection
    const { data, error } = await supabase.from("organizations").select("count").limit(1).single();

    if (error) {
      return NextResponse.json({ 
        status: "error", 
        message: "Supabase connection failed", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      status: "ok", 
      message: "Supabase connection successful",
      data 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      status: "error", 
      message: "Unexpected error", 
      details: e.message 
    }, { status: 500 });
  }
}

