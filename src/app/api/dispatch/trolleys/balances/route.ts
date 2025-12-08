import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

export async function GET(req: NextRequest) {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Try to use the view first, fall back to direct query
    let data;
    let error;

    try {
      const result = await supabase
        .from("v_customer_trolley_summary")
        .select("*")
        .eq("org_id", orgId);
      
      data = result.data;
      error = result.error;
    } catch {
      // View might not exist, use direct query
      const result = await supabase
        .from("customer_trolley_balance")
        .select(`
          *,
          customers (name)
        `)
        .eq("org_id", orgId)
        .gt("trolleys_out", 0);

      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("[GET trolley-balances] error:", error);
      return NextResponse.json({ error: "Failed to fetch balances" }, { status: 500 });
    }

    const balances = (data ?? []).map((b: any) => {
      // Calculate days outstanding
      const lastDelivery = b.last_delivery_date ? new Date(b.last_delivery_date) : null;
      const daysOut = lastDelivery
        ? Math.floor((Date.now() - lastDelivery.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        customerId: b.customer_id,
        customerName: b.customer_name ?? b.customers?.name ?? "Unknown",
        trolleysOut: b.trolleys_out ?? b.trolleys_outstanding ?? 0,
        lastDeliveryDate: b.last_delivery_date,
        lastReturnDate: b.last_return_date,
        daysOutstanding: daysOut,
      };
    });

    // Sort by trolleys out (descending) then by days outstanding
    balances.sort((a: any, b: any) => {
      if (b.trolleysOut !== a.trolleysOut) return b.trolleysOut - a.trolleysOut;
      return (b.daysOutstanding ?? 0) - (a.daysOutstanding ?? 0);
    });

    return NextResponse.json({ balances });
  } catch (error) {
    console.error("[GET trolley-balances] unexpected:", error);
    return NextResponse.json({ error: "Failed to fetch balances" }, { status: 500 });
  }
}

