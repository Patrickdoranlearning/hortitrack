import { getSupabaseForRequest } from "@/server/db/supabaseServer";
import BatchesClient from "./BatchesClient";
export const dynamic = "force-dynamic";

type Row = {
  id: string; batch_number: string; status: string; phase: string;
  quantity: number; planted_at: string | null;
  variety_name: string | null; variety_family: string | null;
  size_name: string | null; container_type: string | null;
  location_name: string | null; supplier_name: string | null;
};

export default async function Page() {
  const supabase = getSupabaseForRequest();
  const { data, error } = await supabase
    .from("v_batch_search")
    .select("id,batch_number,status,phase,quantity,planted_at,variety_name,variety_family,size_name,container_type,location_name,supplier_name")
    .order("batch_number", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load batches: ${error.message}`);

  const initialBatches = (data as Row[] | null)?.map((r) => ({
    id: r.id,
    batchNumber: r.batch_number,
    plantVariety: r.variety_name ?? "", // Mapping to 'plantVariety'
    plantFamily: r.variety_family ?? null, // Mapping to 'plantFamily'
    size: r.size_name ?? null,
    // container: r.container_type ?? null, // Removed as 'container' is not in Batch type
    location: r.location_name ?? null,
    supplier: r.supplier_name ?? null,
    status: r.status,
    phase: r.phase,
    quantity: r.quantity,
    plantedAt: r.planted_at ?? null,
    // Add other Batch properties with default/placeholder values if they are not in the view
    initialQuantity: r.quantity, // Assuming initial_quantity is same as quantity from view
    createdAt: new Date().toISOString(), // Placeholder, replace if view has it
    updatedAt: new Date().toISOString(), // Placeholder, replace if view has it
    logHistory: [], // Placeholder
  })) ?? [];

  return <BatchesClient initialBatches={initialBatches} />;
}
