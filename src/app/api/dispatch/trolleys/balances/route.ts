import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAndOrg } from "@/server/auth/org";
import { differenceInDays } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await createClient();

    // Get all customer equipment balances with customer names
    const { data: balances, error } = await supabase
      .from("customer_trolley_balance")
      .select(`
        customer_id,
        trolleys_out,
        shelves_out,
        last_delivery_date,
        last_return_date,
        customers (
          id,
          name
        )
      `)
      .eq("org_id", orgId)
      .or("trolleys_out.gt.0,shelves_out.gt.0");

    if (error) {
      console.error("Error fetching balances:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data and calculate days outstanding
    const formattedBalances = (balances || []).map((b: any) => {
      // Calculate days outstanding
      let daysOutstanding: number | null = null;
      let hasOverdueItems = false;

      if (b.last_delivery_date) {
        const lastDelivery = new Date(b.last_delivery_date);
        const lastReturn = b.last_return_date ? new Date(b.last_return_date) : null;

        if (!lastReturn || lastDelivery > lastReturn) {
          daysOutstanding = differenceInDays(new Date(), lastDelivery);
          hasOverdueItems = (b.trolleys_out > 0 || b.shelves_out > 0) && daysOutstanding > 14;
        } else {
          daysOutstanding = 0;
        }
      }

      return {
        customerId: b.customer_id,
        customerName: b.customers?.name || "Unknown Customer",
        trolleysOut: b.trolleys_out,
        shelvesOut: b.shelves_out || 0,
        lastDeliveryDate: b.last_delivery_date,
        lastReturnDate: b.last_return_date,
        daysOutstanding,
        hasOverdueItems,
      };
    });

    // Sort: overdue first, then by days outstanding
    formattedBalances.sort((a, b) => {
      if (a.hasOverdueItems !== b.hasOverdueItems) {
        return a.hasOverdueItems ? -1 : 1;
      }
      return (b.daysOutstanding || 0) - (a.daysOutstanding || 0);
    });

    return NextResponse.json({ balances: formattedBalances });
  } catch (error) {
    console.error("Error in balances route:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
