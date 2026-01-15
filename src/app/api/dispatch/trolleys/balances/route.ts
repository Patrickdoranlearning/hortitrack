import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAndOrg } from "@/server/auth/org";
import { differenceInDays } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    // Build query - optionally filter by single customer
    let query = supabase
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
      .eq("org_id", orgId);

    if (customerId) {
      // Single customer lookup
      query = query.eq("customer_id", customerId);
    } else {
      // All customers with outstanding balances
      query = query.or("trolleys_out.gt.0,shelves_out.gt.0");
    }

    const { data: balances, error } = await query;

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

    // If single customer requested, return single balance object
    if (customerId) {
      const balance = formattedBalances[0] ?? {
        customerId,
        customerName: "Unknown",
        trolleysOut: 0,
        shelvesOut: 0,
        lastDeliveryDate: null,
        lastReturnDate: null,
        daysOutstanding: null,
        hasOverdueItems: false,
      };
      return NextResponse.json({ balance });
    }

    return NextResponse.json({ balances: formattedBalances });
  } catch (error) {
    console.error("Error in balances route:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
