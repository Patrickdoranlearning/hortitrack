import { NextResponse } from "next/server";
import { searchLocations } from "@/server/refdata/queries"; // Import the Supabase search function

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || ""; // Get search query from URL params

    const items = await searchLocations(q); // Call the Supabase search function
    
    // The searchLocations function already returns camelCase data in the expected format
    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    console.error("[api/locations] 500", e);
    return NextResponse.json({ items: [], error: e?.message || "Failed to fetch locations" }, { status: 500 });
  }
}
