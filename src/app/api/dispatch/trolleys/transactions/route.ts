import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { generateId } from "@/server/utils/ids";

const createTransactionSchema = z.object({
  trolleyId: z.string().uuid().optional(),
  transactionType: z.enum(["loaded", "delivered", "returned", "damaged", "lost"]),
  quantity: z.number().int().positive().default(1),
  customerId: z.string().uuid().optional(),
  deliveryRunId: z.string().uuid().optional(),
  deliveryItemId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { orgId, supabase, user } = await getUserAndOrg();
    const json = await req.json();
    const payload = createTransactionSchema.parse(json);

    const { data, error } = await supabase
      .from("trolley_transactions")
      .insert({
        id: generateId(),
        org_id: orgId,
        trolley_id: payload.trolleyId,
        transaction_type: payload.transactionType,
        quantity: payload.quantity,
        customer_id: payload.customerId,
        delivery_run_id: payload.deliveryRunId,
        delivery_item_id: payload.deliveryItemId,
        notes: payload.notes,
        recorded_by: user.id,
        transaction_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[POST trolley-transactions] error:", error);
      return NextResponse.json({ error: "Failed to record transaction" }, { status: 500 });
    }

    // Update trolley status if trolleyId provided
    if (payload.trolleyId) {
      const statusMap: Record<string, string> = {
        loaded: "loaded",
        delivered: "at_customer",
        returned: "available",
        damaged: "damaged",
        lost: "lost",
      };

      const newStatus = statusMap[payload.transactionType];
      if (newStatus) {
        await supabase
          .from("trolleys")
          .update({
            status: newStatus,
            customer_id: payload.transactionType === "delivered" ? payload.customerId : null,
            delivery_run_id: payload.transactionType === "loaded" ? payload.deliveryRunId : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.trolleyId);
      }
    }

    // Update customer trolley balance
    if (payload.customerId && (payload.transactionType === "delivered" || payload.transactionType === "returned")) {
      await updateCustomerBalance(supabase, orgId, payload.customerId, payload.transactionType, payload.quantity);
    }

    return NextResponse.json({ id: data.id, ok: true });
  } catch (error) {
    console.error("[POST trolley-transactions] unexpected:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to record transaction" }, { status: 500 });
  }
}

async function updateCustomerBalance(
  supabase: any,
  orgId: string,
  customerId: string,
  transactionType: string,
  quantity: number
) {
  // Get or create customer trolley balance record
  const { data: existing } = await supabase
    .from("customer_trolley_balance")
    .select("*")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const delta = transactionType === "delivered" ? quantity : -quantity;
    const newBalance = Math.max(0, (existing.trolleys_out ?? 0) + delta);

    await supabase
      .from("customer_trolley_balance")
      .update({
        trolleys_out: newBalance,
        last_delivery_date: transactionType === "delivered" ? now : existing.last_delivery_date,
        last_return_date: transactionType === "returned" ? now : existing.last_return_date,
        updated_at: now,
      })
      .eq("id", existing.id);
  } else if (transactionType === "delivered") {
    await supabase.from("customer_trolley_balance").insert({
      id: generateId(),
      org_id: orgId,
      customer_id: customerId,
      trolleys_out: quantity,
      last_delivery_date: now,
    });
  }
}
