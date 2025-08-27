import { getSupabaseForRequest } from "@/server/db/supabaseServer";
import BatchesClient from "./BatchesClient";
export const dynamic = "force-dynamic";

type Row = {
  id: string; batch_number: string; status: string; phase: string; // Ensure phase is explicitly typed
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
    plantVariety: r.variety_name ?? "",
    plantFamily: r.variety_family ?? null,
    size: r.size_name ?? null,
    location: r.location_name ?? null,
    supplier: r.supplier_name ?? null,
    status: r.status,
    phase: r.phase, // Ensure phase is mapped directly from the view
    quantity: r.quantity,
    plantedAt: r.planted_at ?? null,
    initialQuantity: r.quantity, 
    createdAt: new Date().toISOString(), 
    updatedAt: new Date().toISOString(), 
    logHistory: [], 
  })) ?? [];

  return <BatchesClient initialBatches={initialBatches} />;
}
