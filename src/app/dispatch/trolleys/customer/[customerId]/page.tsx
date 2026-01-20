import { Metadata } from "next";
import { getUserAndOrg } from "@/server/auth/org";
import { redirect } from "next/navigation";
import { CustomerTrolleyLedgerClient } from "./CustomerTrolleyLedgerClient";

export const metadata: Metadata = {
  title: "Customer Trolley Ledger | HortiTrack",
  description: "View trolley movement history for a customer",
};

type PageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default async function CustomerTrolleyLedgerPage({ params }: PageProps) {
  const { supabase, orgId } = await getUserAndOrg();
  const { customerId } = await params;

  // Fetch customer details
  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", customerId)
    .eq("org_id", orgId)
    .single();

  if (error || !customer) {
    redirect("/dispatch/trolleys");
  }

  // Fetch movement history
  const { data: movements } = await supabase
    .from("equipment_movement_log")
    .select(
      `
      id,
      movement_date,
      movement_type,
      trolleys,
      shelves,
      delivery_run_id,
      notes,
      signed_docket_url,
      recorded_by,
      delivery_runs (
        id,
        run_number,
        driver_name
      )
    `
    )
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("movement_date", { ascending: false })
    .limit(200);

  // Fetch current balance
  const { data: balance } = await supabase
    .from("customer_trolley_balance")
    .select("trolleys_out, shelves_out, last_delivery_date, last_return_date")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .single();

  return (
    <CustomerTrolleyLedgerClient
      customer={customer}
      movements={movements || []}
      currentBalance={{
        trolleysOut: balance?.trolleys_out || 0,
        shelvesOut: balance?.shelves_out || 0,
        lastDeliveryDate: balance?.last_delivery_date,
        lastReturnDate: balance?.last_return_date,
      }}
    />
  );
}
