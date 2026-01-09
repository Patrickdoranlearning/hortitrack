import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUserAndOrg } from "@/server/auth/org";
import { normalizeSystemCode } from "@/lib/attributeOptions";
import { type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

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

export async function resolveProductionStatus(
  supabase: SupabaseClient,
  orgId: string,
  desiredStatus?: string | null
) {
  const requested = (desiredStatus ?? "Growing").trim();

  const { data, error } = await supabase
    .from("attribute_options")
    .select("id, system_code")
    .eq("org_id", orgId)
    .eq("attribute_key", "production_status")
    .ilike("system_code", requested)
    .maybeSingle();

  if (error) throw error;

  if (data) return data;

  const { data: fallback, error: fallbackErr } = await supabase
    .from("attribute_options")
    .select("id, system_code")
    .eq("org_id", orgId)
    .eq("attribute_key", "production_status")
    .eq("system_code", "Growing")
    .single();

  if (fallbackErr) throw fallbackErr;

  return fallback;
}

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

// -----------------------------------------------------------------------------
// Service Methods
// -----------------------------------------------------------------------------

const PropagationServiceInputSchema = z.object({
  batchNumber: z.string().optional(),
  varietyId: z.string().optional(),
  plant_variety_id: z.string().optional(),
  sizeId: z.string().optional(),
  size_id: z.string().optional(),
  locationId: z.string().optional(),
  location_id: z.string().optional(),
  phase: z.string().optional(),
  status: z.string().optional(),
  quantity: z.number().optional(),
  units: z.number().optional(),
  plantingDate: z.string().optional(),
  planted_at: z.string().optional(),
  supplierId: z.string().optional(),
  supplier_id: z.string().optional(),
  supplierBatchNumber: z.string().optional(),
  notes: z.string().nullable().optional(),
  // Calculation support
  fullTrays: z.number().optional(),
  partialCells: z.number().optional(),
  sizeMultiple: z.number().optional(),
});

export type PropagationInput = z.infer<typeof PropagationServiceInputSchema>;

export async function createPropagationBatch(params: { input: PropagationInput; userId: string }) {
  const { supabase, orgId } = await getUserAndOrg();
  const input = PropagationServiceInputSchema.parse(params.input);
  
  const statusOption = await resolveProductionStatus(supabase, orgId, input.status ?? "Propagation");

  // Resolve quantity: prefer explicit quantity/units, fallback to calculation
  let quantity = input.quantity ?? input.units ?? 0;
  if (!quantity && (input.fullTrays !== undefined || input.partialCells !== undefined)) {
    const multiple = input.sizeMultiple ?? 1;
    quantity = (input.fullTrays ?? 0) * multiple + (input.partialCells ?? 0);
  }

  const { data, error } = await supabase
    .from("batches")
    .insert({
      org_id: orgId,
      batch_number: input.batchNumber ?? `PR-${Date.now()}`,
      plant_variety_id: input.varietyId ?? input.plant_variety_id,
      size_id: input.sizeId ?? input.size_id,
      location_id: input.locationId ?? input.location_id,
      phase: normalizeSystemCode(input.phase ?? "propagation").toLowerCase(),
      status: statusOption.system_code,
      status_id: statusOption.id,
      quantity,
      initial_quantity: quantity,
      planted_at: input.plantingDate ?? input.planted_at ?? null,
      supplier_id: input.supplierId ?? input.supplier_id ?? null,
      supplier_batch_number: input.supplierBatchNumber ?? "",
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

const CheckinServiceInputSchema = z.object({
  batchNumber: z.string().optional(),
  varietyId: z.string().optional(),
  plant_variety_id: z.string().optional(),
  sizeId: z.string().optional(),
  size_id: z.string().optional(),
  locationId: z.string().optional(),
  location_id: z.string().optional(),
  phase: z.string().optional(),
  status: z.string().optional(),
  quantity: z.number().optional(),
  totalUnits: z.number().optional(),
  incomingDate: z.string().optional(),
  supplierId: z.string().optional(),
  supplier_id: z.string().optional(),
  supplierBatchNumber: z.string().optional(),
  passportC: z.string().optional(),
  notes: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export type CheckinInput = z.infer<typeof CheckinServiceInputSchema>;

export async function createCheckinBatch(params: { input: CheckinInput; userId: string }) {
  const { supabase, orgId } = await getUserAndOrg();
  const input = CheckinServiceInputSchema.parse(params.input);
  
  const statusOption = await resolveProductionStatus(supabase, orgId, input.status ?? "Incoming");
  
  const { data, error } = await supabase
    .from("batches")
    .insert({
      org_id: orgId,
      batch_number: input.batchNumber ?? `IN-${Date.now()}`,
      plant_variety_id: input.varietyId ?? input.plant_variety_id,
      size_id: input.sizeId ?? input.size_id,
      location_id: input.locationId ?? input.location_id,
      phase: normalizeSystemCode(input.phase ?? "propagation").toLowerCase(),
      status: statusOption.system_code,
      status_id: statusOption.id,
      quantity: input.totalUnits ?? input.quantity ?? 0,
      initial_quantity: input.totalUnits ?? input.quantity ?? 0,
      incoming_date: input.incomingDate ?? null,
      supplier_id: input.supplierId ?? input.supplier_id ?? null,
      supplier_batch_number: input.supplierBatchNumber ?? input.passportC ?? "",
      notes: input.note ?? input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export type TransplantInput = {
  plantingDate: string;
  quantity: number;
  sizeId: string;
  locationId?: string | null;
  locationName?: string | null;
  logRemainingAsLoss?: boolean;
  notes?: string | null;
};

export async function transplantBatch(batchId: string, input: TransplantInput, userId: string) {
  const { supabase, orgId } = await getUserAndOrg();
  const { data, error } = await supabase.rpc("perform_transplant", {
    p_org_id: orgId,
    p_parent_batch_id: batchId,
    p_size_id: input.sizeId,
    p_location_id: input.locationId ?? null,
    p_containers: input.quantity,
    p_user_id: userId,
    p_planted_at: input.plantingDate ?? null,
    p_notes: input.notes ?? null,
    p_archive_parent_if_empty: input.logRemainingAsLoss ?? false,
  });
  if (error) throw error;
  return data;
}
