import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/server/utils/logger";

export async function GET() {
  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("plant_varieties_compat")
    .select("id, name, family, genus, species, category")
    .order("name");

  if (error) {
    logger.api.error("Varieties lookup failed", error);
    return NextResponse.json({ error: "Failed to fetch varieties" }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}
