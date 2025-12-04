import "server-only";
import { createClient } from "@/lib/supabase/server";

export type BatchNode = {
  id: string;
  orgId: string;
  batchNumber?: string | number | null;
  plantVariety?: string | null;
  plantVarietyId?: string | null;
  plantFamily?: string | null;
  sowDate?: string | null;
  plantingDate?: string | null;
  producedAt?: string | null;
  potSize?: string | number | null;
  supplierName?: string | null;
  supplierId?: string | null;
  size?: string | null;
  location?: string | null;
  status?: string | null;
  quantity?: number | null;
  initialQuantity?: number | null;
  growerPhotoUrl?: string | null;
  salesPhotoUrl?: string | null;
  parentBatchId?: string | null;
  sizeId?: string | null;
  // Add other fields as needed
};

export async function getBatchById(id: string): Promise<BatchNode | null> {
  const supabase = await createClient();
  const { data: d, error } = await supabase
    .from("batches")
    .select("*, plant_varieties(name, family), plant_sizes(name), nursery_locations(name)")
    .eq("id", id)
    .single();

  if (error || !d) return null;

  // Map snake_case to camelCase
  return {
    id: d.id,
    orgId: d.org_id,
    batchNumber: d.batch_number ?? null,
    plantVariety: d.plant_varieties?.name ?? null,
    plantVarietyId: d.plant_variety_id ?? null,
    plantFamily: d.plant_varieties?.family ?? null,
    sowDate: d.sow_date ?? null,
    plantingDate: d.planting_date ?? d.planted_at ?? null,
    producedAt: d.produced_at ?? d.ready_at ?? null,
    potSize: d.plant_sizes?.name ?? null,
    size: d.plant_sizes?.name ?? null,
    sizeId: d.size_id ?? null,
    supplierName: d.supplier_name ?? null, // Need to join suppliers if this is an ID now
    supplierId: d.supplier_id ?? null,
    location: d.nursery_locations?.name ?? null,
    status: d.status ?? null,
    quantity: d.quantity ?? 0,
    initialQuantity: d.initial_quantity ?? 0,
    growerPhotoUrl: d.grower_photo_url ?? d.qr_image_url ?? null, // Fallback or specific field
    salesPhotoUrl: d.sales_photo_url ?? null,
    parentBatchId: d.parent_batch_id ?? null,
  };
}

export async function getBatchLogs(id: string, limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .eq("batch_id", id)
    .order("date", { ascending: true })
    .limit(limit);

  if (error) return [];
  return data;
}

export async function getBatchPhotos(id: string, limit = 60) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("batch_photos")
    .select("*")
    .eq("batch_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data;
}
