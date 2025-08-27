import { NextResponse } from "next/server";
import { searchVarieties } from "@/server/refdata/queries"; // Import the Supabase search function

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    const items = await searchVarieties(q); // Call the Supabase search function
    
    // The searchVarieties function already returns camelCase data in the expected format.
    // If the client needs a 'meta' property, we can construct it here.
    const formattedItems = items.map((v: any) => ({
      id: v.id,
      name: v.name,
      meta: { family: v.family, genus: v.genus, species: v.species, colour: v.colour, rating: v.rating }
    }));

    return NextResponse.json({ items: formattedItems }, { status: 200 });
  } catch (e: any) {
    console.error("[api/search/varieties] 500", e);
    return NextResponse.json({ items: [], error: e?.message || "Failed to fetch varieties" }, { status: 500 });
  }
}
