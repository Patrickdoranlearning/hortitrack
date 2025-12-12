import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAndOrg } from "@/server/auth/org";
import { z } from "zod";

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
    const { orgId } = await getUserAndOrg();
    const supabase = await createClient();
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
      console.error("Error fetching transactions:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data
    const formattedTransactions = (transactions || []).map((t: any) => ({
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
    console.error("Error in transactions route:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, userId } = await getUserAndOrg();
    const supabase = await createClient();
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
        recorded_by: userId,
        movement_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating movement:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transaction: movement }, { status: 201 });
  } catch (error) {
    console.error("Error in create movement:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
