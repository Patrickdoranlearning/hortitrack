import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { generateId } from "@/server/utils/ids";
import { logger, getErrorMessage } from "@/server/utils/logger";

// List and create trolleys
const createTrolleySchema = z.object({
  trolleyNumber: z.string().min(1, "Trolley number is required"),
  trolleyType: z.string().default("danish"),
  status: z.enum(["available", "loaded", "at_customer", "returned", "damaged", "lost"]).default("available"),
  conditionNotes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("trolleys")
      .select(`
        *,
        customers (name),
        delivery_runs (run_number)
      `)
      .eq("org_id", orgId)
      .order("trolley_number", { ascending: true });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      logger.trolley.error("Error fetching trolleys", error, { orgId });
      return NextResponse.json({ error: "Failed to fetch trolleys" }, { status: 500 });
    }

    // Type for trolley query result with joins
    type TrolleyQueryRow = {
      id: string;
      trolley_number: string;
      trolley_type: string | null;
      status: string | null;
      current_location: string | null;
      customer_id: string | null;
      delivery_run_id: string | null;
      condition_notes: string | null;
      last_inspection_date: string | null;
      created_at: string;
      updated_at: string;
      customers: { name: string } | null;
      delivery_runs: { run_number: string } | null;
    };

    const trolleys = ((data ?? []) as TrolleyQueryRow[]).map((t) => ({
      id: t.id,
      trolleyNumber: t.trolley_number,
      trolleyType: t.trolley_type ?? "danish",
      status: t.status ?? "available",
      currentLocation: t.current_location,
      customerId: t.customer_id,
      customerName: t.customers?.name ?? null,
      deliveryRunId: t.delivery_run_id,
      runNumber: t.delivery_runs?.run_number ?? null,
      conditionNotes: t.condition_notes,
      lastInspectionDate: t.last_inspection_date,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return NextResponse.json({ trolleys });
  } catch (error) {
    logger.trolley.error("Unexpected error in GET trolleys", error);
    return NextResponse.json({ error: "Failed to fetch trolleys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, supabase } = await getUserAndOrg();
    const json = await req.json();
    const payload = createTrolleySchema.parse(json);

    // Check for duplicate trolley number
    const { data: existing } = await supabase
      .from("trolleys")
      .select("id")
      .eq("org_id", orgId)
      .eq("trolley_number", payload.trolleyNumber)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Trolley ${payload.trolleyNumber} already exists` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("trolleys")
      .insert({
        id: generateId(),
        org_id: orgId,
        trolley_number: payload.trolleyNumber,
        trolley_type: payload.trolleyType,
        status: payload.status,
        condition_notes: payload.conditionNotes,
      })
      .select()
      .single();

    if (error) {
      logger.trolley.error("Error creating trolley", error, { trolleyNumber: payload.trolleyNumber });
      return NextResponse.json({ error: "Failed to create trolley" }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      trolleyNumber: data.trolley_number,
      status: data.status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    logger.trolley.error("Unexpected error in POST trolleys", error);
    return NextResponse.json({ error: "Failed to create trolley" }, { status: 500 });
  }
}
