import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getCustomerTrolleyBalance } from "@/server/dispatch/trolley-balance.server";
import { z } from "zod";
import { logger, getErrorMessage } from "@/server/utils/logger";

const createMovementSchema = z.object({
  type: z.enum(["delivered", "returned", "not_returned", "adjustment"]),
  customerId: z.string().uuid(),
  trolleys: z.number().int().min(0),
  shelves: z.number().int().min(0),
  notes: z.string().optional(),
  deliveryRunId: z.string().uuid().optional(),
  signedDocketUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await getUserAndOrg();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const customerId = searchParams.get("customerId");

    // Build query - simplified without driver relationship
    let query = supabase
      .from("equipment_movement_log")
      .select(`
        id,
        movement_date,
        movement_type,
        customer_id,
        trolleys,
        shelves,
        delivery_run_id,
        notes,
        signed_docket_url,
        recorded_by,
        created_at,
        customers (
          id,
          name
        ),
        delivery_runs (
          id,
          run_number,
          driver_name
        )
      `)
      .eq("org_id", orgId)
      .order("movement_date", { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data: transactions, error } = await query;

    if (error) {
      logger.trolley.error("Error fetching transactions", error, { orgId, customerId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Type for transaction query result
    type TransactionQueryRow = {
      id: string;
      movement_date: string;
      movement_type: string;
      customer_id: string;
      trolleys: number;
      shelves: number;
      delivery_run_id: string | null;
      notes: string | null;
      signed_docket_url: string | null;
      recorded_by: string | null;
      created_at: string;
      customers: { id: string; name: string } | null;
      delivery_runs: { id: string; run_number: string; driver_name: string | null } | null;
    };

    // Transform data
    const formattedTransactions = ((transactions || []) as unknown as TransactionQueryRow[]).map((t) => ({
      id: t.id,
      date: t.movement_date,
      type: t.movement_type,
      customerId: t.customer_id,
      customerName: t.customers?.name || "Unknown Customer",
      trolleys: t.trolleys,
      shelves: t.shelves,
      deliveryRunId: t.delivery_run_id,
      deliveryRunNumber: t.delivery_runs?.run_number,
      driverName: t.delivery_runs?.driver_name,
      notes: t.notes,
      signedDocketUrl: t.signed_docket_url,
      recordedBy: t.recorded_by,
    }));

    return NextResponse.json({ transactions: formattedTransactions });
  } catch (error) {
    logger.trolley.error("Error in transactions route", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, user, supabase } = await getUserAndOrg();
    const body = await request.json();

    // Validate
    const parsed = createMovementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Create movement record
    const { data: movement, error } = await supabase
      .from("equipment_movement_log")
      .insert({
        org_id: orgId,
        movement_type: data.type,
        customer_id: data.customerId,
        trolleys: data.trolleys,
        shelves: data.shelves,
        notes: data.notes || null,
        delivery_run_id: data.deliveryRunId || null,
        signed_docket_url: data.signedDocketUrl || null,
        recorded_by: user.id,
        movement_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.trolley.error("Error creating movement", error, { customerId: data.customerId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // The database trigger automatically updates customer_trolley_balance
    // Fetch the updated balance to return to the client
    const updatedBalance = await getCustomerTrolleyBalance(data.customerId);

    return NextResponse.json(
      {
        transaction: movement,
        updatedBalance: updatedBalance
          ? {
              trolleysOut: updatedBalance.trolleysOut,
              shelvesOut: updatedBalance.shelvesOut,
              lastDeliveryDate: updatedBalance.lastDeliveryDate,
              lastReturnDate: updatedBalance.lastReturnDate,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.trolley.error("Error in create movement route", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
