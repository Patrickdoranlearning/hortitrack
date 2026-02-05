import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DocumentType = "invoice" | "delivery_docket" | "credit_note" | "order_confirmation";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get company settings where template preferences are stored
  const { data: company, error } = await supabase
    .from("companies")
    .select("template_preferences")
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return saved preferences or defaults
  const defaults: Record<DocumentType, string> = {
    invoice: "classic",
    delivery_docket: "classic",
    credit_note: "classic",
    order_confirmation: "classic",
  };

  return NextResponse.json({
    selections: company?.template_preferences || defaults,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { selections } = body;

  if (!selections) {
    return NextResponse.json({ error: "Missing selections" }, { status: 400 });
  }

  // Update company template preferences
  const { error } = await supabase
    .from("companies")
    .update({ template_preferences: selections })
    .eq("id", user.user_metadata?.company_id);

  if (error) {
    // If no company row exists, try to insert or use user preferences
    const { error: upsertError } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        template_preferences: selections,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
