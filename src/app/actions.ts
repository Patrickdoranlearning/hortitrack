
'use server';

import type { CareRecommendationsInput } from '@/ai/flows/care-recommendations';
import type { BatchChatInput } from '@/ai/flows/batch-chat-flow';
import type { NurseryIntelligenceInput } from '@/ai/flows/nursery-intelligence';
import type { Batch, Customer, Haulier, HaulierVehicle, NurseryLocation, PlantSize, Site, Supplier, SupplierAddress, SupplierAddressSummary, Variety } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import { declassify } from '@/server/utils/declassify';
import { snakeToCamel } from '@/lib/utils';
import { getOrgDetails, getUserAndOrg } from '@/server/auth/org';
import { logError } from '@/lib/log';

async function getSupabaseForApp() {
  return createClient();
}

// Use typed view row instead of `any`
type VBatchSearchRow = Database['public']['Views']['v_batch_search']['Row'];

function transformVBatchSearchData(data: VBatchSearchRow): Batch {
    const camelCaseData = snakeToCamel(data);
    // Distribution comes as JSONB from the view, already in camelCase
    const distribution = (data as any).distribution ?? null;
    return {
        ...camelCaseData,
        batchNumber: camelCaseData.batchNumber,
        plantVariety: camelCaseData.varietyName ?? '',
        // The view column is "family" (not "variety_family"), so after snakeToCamel it's just "family"
        plantFamily: camelCaseData.family ?? camelCaseData.varietyFamily ?? null,
        size: camelCaseData.sizeName ?? '',
        location: camelCaseData.locationName ?? null,
        locationSite: camelCaseData.locationSite ?? null,
        supplier: camelCaseData.supplierName ?? null,
        initialQuantity: camelCaseData.initialQuantity ?? camelCaseData.quantity ?? 0,
        reservedQuantity: camelCaseData.reservedQuantity ?? 0,
        saleableQuantity: camelCaseData.saleableQuantity ?? null,
        plantedAt: camelCaseData.plantedAt ?? camelCaseData.createdAt,
        plantingDate: camelCaseData.plantedAt ?? camelCaseData.createdAt,
        category: camelCaseData.category ?? camelCaseData.varietyCategory ?? '',
        createdAt: camelCaseData.createdAt,
        updatedAt: camelCaseData.updatedAt,
        logHistory: (data as any).log_history ?? [],
        // Include distribution data inline (no more separate API calls!)
        distribution: distribution ?? undefined,
    };
}

async function getBatchById(batchId: string): Promise<Batch | null> {
    const supabase = await getSupabaseForApp();
    const { data, error } = await supabase
        .from("v_batch_search") 
        .select("*") 
        .eq("id", batchId)
        .maybeSingle();
    
    if (error) {
        logError('[getBatchById] Supabase error from v_batch_search', { error: error.message });
        return null;
    }
    return data ? transformVBatchSearchData(data as VBatchSearchRow) : null;
}

const plantSizeColumnMap = {
  camel: [
    'id',
    'name',
    'containerType',
    'cellMultiple',
    'trayQuantity',
    'shelfQuantity',
    'trolleyQuantity',
    'area',
    'cellVolumeL',
    'cellDiameterMm',
    'cellWidthMm',
    'cellLengthMm',
    'cellShape',
  ] as const,
  snake: [
    'id',
    'name',
    'container_type',
    'cell_multiple',
    'tray_quantity',
    'shelf_quantity',
    'trolley_quantity',
    'area',
    'cell_volume_l',
    'cell_diameter_mm',
    'cell_width_mm',
    'cell_length_mm',
    'cell_shape',
  ] as const,
};

function mapPlantSizeToDb(size: Partial<PlantSize>) {
  const payload: Record<string, any> = {};
  plantSizeColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = plantSizeColumnMap.snake[index];
    const value = (size as any)[camelKey];
    if (value !== undefined && value !== null) {
      payload[dbKey] = value;
    }
  });
  return payload;
}

function normalizePlantSizeRow(row?: any): PlantSize | undefined {
  if (!row) return undefined;
  const normalized: Record<string, any> = {};
  plantSizeColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = plantSizeColumnMap.snake[index];
    normalized[camelKey] = row[dbKey];
  });
  return normalized as PlantSize;
}

const varietyColumnMap = {
  camel: [
    'id',
    'orgId',
    'name',
    'family',
    'genus',
    'species',
    'category',
    'colour',
    'commonName',
    'floweringPeriod',
    'flowerColour',
    'evergreen',
    'plantBreedersRights',
    'rating',
  ] as const,
  snake: [
    'id',
    'org_id',
    'name',
    'family',
    'genus',
    'species',
    'category',
    'colour',
    'common_name',
    'flowering_period',
    'flower_colour',
    'evergreen',
    'plant_breeders_rights',
    'rating',
  ] as const,
};

function mapVarietyToDb(variety: Partial<Variety>) {
  const payload: Record<string, any> = {};
  varietyColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = varietyColumnMap.snake[index];
    const value = (variety as any)[camelKey];
    if (value !== undefined && value !== null) {
      payload[dbKey] = value;
    }
  });
  return payload;
}

function normalizeVarietyRow(row?: any): Variety | undefined {
  if (!row) return undefined;
  const normalized: Record<string, any> = {};
  varietyColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = varietyColumnMap.snake[index];
    normalized[camelKey] = row[dbKey];
  });
  return normalized as Variety;
}

const locationColumnMap = {
  camel: ['id', 'orgId', 'siteId', 'name', 'nurserySite', 'covered', 'area', 'type', 'healthStatus', 'restrictedUntil'] as const,
  snake: ['id', 'org_id', 'site_id', 'name', 'nursery_site', 'covered', 'area', 'type', 'health_status', 'restricted_until'] as const,
};

function mapLocationToDb(location: Partial<NurseryLocation>) {
  const payload: Record<string, any> = {};
  locationColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = locationColumnMap.snake[index];
    const value = (location as any)[camelKey];
    if (value !== undefined && value !== null) {
      payload[dbKey] = value;
    }
  });
  return payload;
}

function normalizeLocationRow(row?: any): NurseryLocation | undefined {
  if (!row) return undefined;
  const normalized: Record<string, any> = {};
  locationColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = locationColumnMap.snake[index];
    if (dbKey === 'area') {
      const val = row[dbKey];
      normalized[camelKey] = typeof val === 'number' ? val : val === null || val === undefined ? undefined : Number(val);
    } else {
      normalized[camelKey] = row[dbKey];
    }
  });
  return normalized as NurseryLocation;
}

const supplierColumnMap = {
  camel: ['id', 'orgId', 'name', 'producerCode', 'countryCode', 'phone', 'email', 'address', 'eircode', 'supplierType'] as const,
  snake: ['id', 'org_id', 'name', 'producer_code', 'country_code', 'phone', 'email', 'address', 'eircode', 'supplier_type'] as const,
};

function mapSupplierToDb(supplier: Partial<Supplier>) {
  const payload: Record<string, any> = {};
  supplierColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = supplierColumnMap.snake[index];
    const value = (supplier as any)[camelKey];
    if (value !== undefined && value !== null) {
      payload[dbKey] = value;
    }
  });
  return payload;
}

function normalizeSupplierRow(row?: any): Supplier | undefined {
  if (!row) return undefined;
  const normalized: Record<string, any> = {};
  supplierColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = supplierColumnMap.snake[index];
    normalized[camelKey] = row[dbKey];
  });
  return normalized as Supplier;
}

const customerColumnMap = {
  camel: [
    'id',
    'orgId',
    'code',
    'name',
    'email',
    'phone',
    'vatNumber',
    'notes',
    'defaultPriceListId',
    'store',
    'accountsEmail',
    'pricingTier',
  ] as const,
  snake: [
    'id',
    'org_id',
    'code',
    'name',
    'email',
    'phone',
    'vat_number',
    'notes',
    'default_price_list_id',
    'store',
    'accounts_email',
    'pricing_tier',
  ] as const,
};

function mapCustomerToDb(customer: Partial<Customer>) {
  const payload: Record<string, any> = {};
  customerColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = customerColumnMap.snake[index];
    const value = (customer as any)[camelKey];
    if (value !== undefined && value !== null) {
      payload[dbKey] = value;
    }
  });
  return payload;
}

function normalizeCustomerRow(row?: any): Customer | undefined {
  if (!row) return undefined;
  const normalized: Record<string, any> = {};
  customerColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = customerColumnMap.snake[index];
    normalized[camelKey] = row[dbKey];
  });
  return normalized as Customer;
}

const haulierColumnMap = {
  camel: ['id', 'orgId', 'name', 'phone', 'email', 'notes', 'isActive'] as const,
  snake: ['id', 'org_id', 'name', 'phone', 'email', 'notes', 'is_active'] as const,
};

function mapHaulierToDb(haulier: Partial<Haulier>) {
  const payload: Record<string, any> = {};
  haulierColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = haulierColumnMap.snake[index];
    const value = (haulier as any)[camelKey];
    if (value !== undefined && value !== null) {
      payload[dbKey] = value;
    }
  });
  return payload;
}

function normalizeHaulierRow(row?: any): Haulier | undefined {
  if (!row) return undefined;
  const normalized: Record<string, any> = {};
  haulierColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = haulierColumnMap.snake[index];
    normalized[camelKey] = row[dbKey];
  });
  return normalized as Haulier;
}

/**
 * Server-side batch filtering options
 */
export type GetBatchesOptions = {
  query?: string;           // Search term for batch number or variety
  status?: string;          // Filter by status
  plantFamily?: string;     // Filter by plant family
  category?: string;        // Filter by category
  limit?: number;           // Pagination limit
  offset?: number;          // Pagination offset
};

export async function getBatchesAction(options: GetBatchesOptions = {}) {
    try {
        // Get the user's org_id for RLS filtering
        // This explicit filter is required for server-side queries and improves query performance
        const { orgId } = await getUserAndOrg();
        const supabase = await getSupabaseForApp();

        // Build query with server-side filtering
        // Using estimated count for better performance (avoids full table scan)
        let query = supabase
            .from("v_batch_search")
            .select("*", { count: 'estimated' })
            .eq("org_id", orgId); // Required: explicit org filter for RLS + performance

        // Apply text search filter
        if (options.query && options.query.trim()) {
            const searchTerm = `%${options.query.trim()}%`;
            query = query.or(`batch_number.ilike.${searchTerm},variety_name.ilike.${searchTerm}`);
        }

        // Apply status filter
        if (options.status && options.status !== 'all') {
            query = query.eq('status', options.status);
        }

        // Apply plant family filter (column is "family" in v_batch_search view)
        if (options.plantFamily && options.plantFamily !== 'all') {
            query = query.eq('family', options.plantFamily);
        }

        // Apply category filter (column is "category" in v_batch_search view)
        if (options.category && options.category !== 'all') {
            query = query.eq('category', options.category);
        }

        // Apply pagination (with sensible defaults)
        const limit = options.limit ?? 100;
        const offset = options.offset ?? 0;
        query = query.range(offset, offset + limit - 1);

        // Order by created_at descending
        query = query.order("created_at", { ascending: false });

        const { data: batches, error, count } = await query;

        if (error) {
            logError('[getBatchesAction] Supabase error from v_batch_search', { error: error.message });
            throw error;
        }
        
        const transformedBatches = (batches || []).map((b) => 
            transformVBatchSearchData(b as VBatchSearchRow)
        );
        
        return { 
            success: true, 
            data: declassify(transformedBatches) as unknown as Batch[],
            total: count ?? 0,
        };
    } catch (error: unknown) {
        logError('[getBatchesAction] Error in action', { error: error instanceof Error ? error.message : String(error) });
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: 'Failed to fetch batches: ' + message };
    }
}

export async function getProductionProtocolAction(batchId: string) {
  try {
    const { productionProtocol } = await import('@/ai/flows/production-protocol');
    const batch = await getBatchById(batchId);
    if (!batch) {
        return { success: false, error: 'Batch not found.' };
    }
    const protocol = await productionProtocol(batch);
    return { success: true, data: protocol };
  } catch (error) {
    logError('[getProductionProtocolAction] error', { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to generate AI production protocol.',
    };
  }
}

export async function getCareRecommendationsAction(batchId: string) {
  try {
    const { careRecommendations } = await import('@/ai/flows/care-recommendations');
    const [batch, org] = await Promise.all([
      getBatchById(batchId),
      getOrgDetails().catch(() => null)
    ]);

    if (!batch) {
        return { success: false, error: 'Batch not found.' };
    }
    const batchForCare = batch as any;
    const input: CareRecommendationsInput = {
      batchInfo: {
        plantFamily: batchForCare.plantFamily ?? null,
        plantVariety: batch.plantVariety,
        plantingDate: batch.plantedAt ?? batchForCare.plantingDate ?? new Date().toISOString(),
      },
      logHistory: (batch.logHistory || []).map((log: any) => log.note || log.type || log.action || 'Log entry'),
      location: org?.latitude && org?.longitude ? {
        latitude: org.latitude,
        longitude: org.longitude
      } : undefined
    };
    const recommendations = await careRecommendations(input);
    return { success: true, data: recommendations };
  } catch (error: any) {
    logError('[getCareRecommendationsAction] error', { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to generate AI care recommendations: ${message}`,
    };
  }
}

export async function batchChatAction(batchId: string, query: string) {
  try {
    const { batchChat } = await import('@/ai/flows/batch-chat-flow');
    const batch = await getBatchById(batchId);
    if (!batch) {
        return { success: false, error: 'Batch not found.' };
    }
    const input: BatchChatInput = { batch, query };
    const result = await batchChat(input);
    return { success: true, data: result };
  } catch (error: any) {
    logError('[batchChatAction] error', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: 'Failed to get AI response.' };
  }
}

export async function addLocationAction(locationData: Omit<NurseryLocation, 'id'>) {
    const [{ orgId }, supabase] = await Promise.all([getUserAndOrg(), getSupabaseForApp()]);
    const payload = {
      ...mapLocationToDb(locationData),
      org_id: orgId,
    };
    const { data, error } = await supabase.from('nursery_locations').insert([payload]).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeLocationRow(data?.[0]) };
}

export async function updateLocationAction(locationData: NurseryLocation) {
    const supabase = await getSupabaseForApp();
    const payload = mapLocationToDb(locationData);
    const { data, error } = await supabase.from('nursery_locations').update(payload).eq('id', locationData.id).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeLocationRow(data?.[0]) };
}

export async function deleteLocationAction(locationId: string) {
    const supabase = await getSupabaseForApp();
    const { error } = await supabase.from('nursery_locations').delete().eq('id', locationId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// --- Sites ---
function normalizeSiteRow(row: any): Site | null {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSitesAction() {
  const [{ orgId }, supabase] = await Promise.all([getUserAndOrg(), getSupabaseForApp()]);
  const { data, error } = await supabase
    .from('sites')
    .select('*, nursery_locations(id)')
    .eq('org_id', orgId)
    .order('name');
  if (error) return { success: false, error: error.message, data: [] };
  const sites = (data || []).map((row: any) => ({
    ...normalizeSiteRow(row),
    locationCount: row.nursery_locations?.length ?? 0,
  }));
  return { success: true, data: sites };
}

export async function addSiteAction(siteData: Omit<Site, 'id'>) {
  const [{ orgId }, supabase] = await Promise.all([getUserAndOrg(), getSupabaseForApp()]);
  const payload = {
    org_id: orgId,
    name: siteData.name,
  };
  const { data, error } = await supabase.from('sites').insert([payload]).select();
  if (error) return { success: false, error: error.message };
  return { success: true, data: normalizeSiteRow(data?.[0]) };
}

export async function updateSiteAction(siteData: Site) {
  const supabase = await getSupabaseForApp();
  const payload = {
    name: siteData.name,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('sites').update(payload).eq('id', siteData.id).select();
  if (error) return { success: false, error: error.message };
  return { success: true, data: normalizeSiteRow(data?.[0]) };
}

export async function deleteSiteAction(siteId: string) {
  const supabase = await getSupabaseForApp();
  // Check if any locations are linked to this site
  const { data: linkedLocations } = await supabase
    .from('nursery_locations')
    .select('id')
    .eq('site_id', siteId)
    .limit(1);
  if (linkedLocations && linkedLocations.length > 0) {
    return { success: false, error: 'Cannot delete site with linked locations. Reassign or remove locations first.' };
  }
  const { error } = await supabase.from('sites').delete().eq('id', siteId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function addSizeAction(sizeData: Omit<PlantSize, 'id'>) {
    const supabase = await getSupabaseForApp();
    const payload = mapPlantSizeToDb(sizeData);
    const { data, error } = await supabase.from('plant_sizes').insert([payload]).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizePlantSizeRow(data?.[0]) };
}

export async function updateSizeAction(sizeData: PlantSize) {
    const supabase = await getSupabaseForApp();
    const payload = mapPlantSizeToDb(sizeData);
    const { data, error } = await supabase
      .from('plant_sizes')
      .update(payload)
      .eq('id', sizeData.id)
      .select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizePlantSizeRow(data?.[0]) };
}

export async function deleteSizeAction(sizeId: string) {
    const supabase = await getSupabaseForApp();
    const { error } = await supabase.from('plant_sizes').delete().eq('id', sizeId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function addSupplierAction(supplierData: Omit<Supplier, 'id'>) {
    const [{ orgId }, supabase] = await Promise.all([getUserAndOrg(), getSupabaseForApp()]);
    const payload = {
      ...mapSupplierToDb(supplierData),
      org_id: orgId,
    };
    const { data, error } = await supabase.from('suppliers').insert([payload]).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeSupplierRow(data?.[0]) };
}

export async function updateSupplierAction(supplierData: Supplier) {
    const supabase = await getSupabaseForApp();
    const payload = mapSupplierToDb(supplierData);
    const { data, error } = await supabase.from('suppliers').update(payload).eq('id', supplierData.id).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeSupplierRow(data?.[0]) };
}

export async function deleteSupplierAction(supplierId: string) {
    const supabase = await getSupabaseForApp();
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// --- Supplier Address Actions ---

const supplierAddressColumnMap = {
  camel: ['id', 'supplierId', 'orgId', 'label', 'line1', 'line2', 'city', 'county', 'eircode', 'countryCode', 'isDefault', 'contactName', 'contactEmail', 'contactPhone'] as const,
  snake: ['id', 'supplier_id', 'org_id', 'label', 'line1', 'line2', 'city', 'county', 'eircode', 'country_code', 'is_default', 'contact_name', 'contact_email', 'contact_phone'] as const,
};

function mapSupplierAddressToDb(address: Partial<SupplierAddress>) {
  const payload: Record<string, any> = {};
  supplierAddressColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = supplierAddressColumnMap.snake[index];
    const value = (address as any)[camelKey];
    if (value !== undefined) {
      payload[dbKey] = value === '' ? null : value;
    }
  });
  return payload;
}

function normalizeSupplierAddressRow(row?: any): SupplierAddressSummary | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    label: row.label,
    line1: row.line1,
    line2: row.line2 ?? null,
    city: row.city ?? null,
    county: row.county ?? null,
    eircode: row.eircode ?? null,
    countryCode: row.country_code ?? 'IE',
    isDefault: row.is_default ?? false,
    contactName: row.contact_name ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
  };
}

export async function listSupplierAddressesAction(supplierId: string) {
  const supabase = await getSupabaseForApp();
  const { data, error } = await supabase
    .from('supplier_addresses')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('is_default', { ascending: false })
    .order('label');
  
  if (error) return { success: false, error: error.message, data: [] };
  return { 
    success: true, 
    data: (data ?? []).map(normalizeSupplierAddressRow).filter(Boolean) as SupplierAddressSummary[] 
  };
}

export async function upsertSupplierAddressAction(addressData: Partial<SupplierAddress> & { supplierId: string }) {
  const [{ orgId }, supabase] = await Promise.all([getUserAndOrg(), getSupabaseForApp()]);
  
  const payload = {
    ...mapSupplierAddressToDb(addressData),
    org_id: orgId,
    supplier_id: addressData.supplierId,
  };
  
  // If setting as default, unset other defaults first
  if (addressData.isDefault) {
    await supabase
      .from('supplier_addresses')
      .update({ is_default: false })
      .eq('supplier_id', addressData.supplierId)
      .neq('id', addressData.id ?? '');
  }
  
  if (addressData.id) {
    // Update existing
    const { data, error } = await supabase
      .from('supplier_addresses')
      .update(payload)
      .eq('id', addressData.id)
      .select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeSupplierAddressRow(data?.[0]) };
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('supplier_addresses')
      .insert([payload])
      .select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeSupplierAddressRow(data?.[0]) };
  }
}

export async function deleteSupplierAddressAction(addressId: string) {
  const supabase = await getSupabaseForApp();
  const { error } = await supabase.from('supplier_addresses').delete().eq('id', addressId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function addCustomerAction(customerData: Omit<Customer, 'id'>) {
    const [{ orgId }, supabase] = await Promise.all([getUserAndOrg(), getSupabaseForApp()]);
    const payload = {
      ...mapCustomerToDb(customerData),
      org_id: orgId,
    };
    const { data, error } = await supabase.from('customers').insert([payload]).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeCustomerRow(data?.[0]) };
}

export async function updateCustomerAction(customerData: Customer) {
    const supabase = await getSupabaseForApp();
    const payload = mapCustomerToDb(customerData);
    const { data, error } = await supabase.from('customers').update(payload).eq('id', customerData.id).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeCustomerRow(data?.[0]) };
}

export async function deleteCustomerAction(customerId: string) {
    const supabase = await getSupabaseForApp();
    const { error } = await supabase.from('customers').delete().eq('id', customerId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function addHaulierAction(haulierData: Omit<Haulier, 'id'>) {
    const [{ orgId }, supabase] = await Promise.all([getUserAndOrg(), getSupabaseForApp()]);
    const payload = {
      ...mapHaulierToDb(haulierData),
      org_id: orgId,
    };
    const { data, error } = await supabase.from('hauliers').insert([payload]).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeHaulierRow(data?.[0]) };
}

export async function updateHaulierAction(haulierData: Haulier) {
    const supabase = await getSupabaseForApp();
    const payload = mapHaulierToDb(haulierData);
    const { data, error } = await supabase.from('hauliers').update(payload).eq('id', haulierData.id).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeHaulierRow(data?.[0]) };
}

export async function deleteHaulierAction(haulierId: string) {
    const supabase = await getSupabaseForApp();

    // Check for related records that would prevent deletion
    const [vehiclesCheck, runsCheck, balanceCheck] = await Promise.all([
      supabase.from('haulier_vehicles').select('id', { count: 'exact', head: true }).eq('haulier_id', haulierId),
      supabase.from('delivery_runs').select('id', { count: 'exact', head: true }).eq('haulier_id', haulierId),
      supabase.from('haulier_trolley_balance').select('haulier_id', { count: 'exact', head: true }).eq('haulier_id', haulierId),
    ]);

    const vehicleCount = vehiclesCheck.count ?? 0;
    const runCount = runsCheck.count ?? 0;
    const balanceCount = balanceCheck.count ?? 0;

    // Build a meaningful error message if there are related records
    const blockers: string[] = [];
    if (vehicleCount > 0) blockers.push(`${vehicleCount} vehicle${vehicleCount > 1 ? 's' : ''}`);
    if (runCount > 0) blockers.push(`${runCount} delivery run${runCount > 1 ? 's' : ''}`);
    if (balanceCount > 0) blockers.push('trolley balance records');

    if (blockers.length > 0) {
      return {
        success: false,
        error: `Cannot delete haulier: has ${blockers.join(', ')}. Remove these first or mark the haulier as inactive instead.`
      };
    }

    const { error } = await supabase.from('hauliers').delete().eq('id', haulierId);
    if (error) {
      // Handle any remaining FK constraint errors gracefully
      if (error.message.includes('foreign key constraint')) {
        return { success: false, error: 'Cannot delete haulier: it is referenced by other records. Mark as inactive instead.' };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
}

// --- Haulier Vehicle Actions ---

const vehicleColumnMap = {
  camel: ['id', 'orgId', 'haulierId', 'name', 'registration', 'vehicleType', 'trolleyCapacity', 'isActive', 'notes', 'truckLayout'] as const,
  snake: ['id', 'org_id', 'haulier_id', 'name', 'registration', 'vehicle_type', 'trolley_capacity', 'is_active', 'notes', 'truck_layout'] as const,
};

function mapVehicleToDb(vehicle: Partial<HaulierVehicle>) {
  const payload: Record<string, any> = {};
  vehicleColumnMap.camel.forEach((camelKey, index) => {
    const dbKey = vehicleColumnMap.snake[index];
    const value = (vehicle as any)[camelKey];
    if (value !== undefined && value !== null) {
      payload[dbKey] = value;
    }
  });
  return payload;
}

function normalizeVehicleRow(row?: any): HaulierVehicle | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    orgId: row.org_id,
    haulierId: row.haulier_id,
    name: row.name,
    registration: row.registration ?? undefined,
    vehicleType: row.vehicle_type ?? undefined,
    trolleyCapacity: row.trolley_capacity ?? 10,
    isActive: row.is_active ?? true,
    notes: row.notes ?? undefined,
    truckLayout: row.truck_layout ?? undefined,
  };
}

export async function getVehiclesAction() {
    const [{ orgId }, supabase] = await Promise.all([getUserAndOrg(), getSupabaseForApp()]);
    const { data, error } = await supabase
      .from('haulier_vehicles')
      .select('*, hauliers(name)')
      .eq('org_id', orgId)
      .order('name');
    if (error) return { success: false, error: error.message, data: [] };
    return {
      success: true,
      data: (data ?? []).map(row => ({
        ...normalizeVehicleRow(row),
        haulierName: (row as any).hauliers?.name ?? 'Unknown',
      }))
    };
}

export async function addVehicleAction(vehicleData: Omit<HaulierVehicle, 'id'>) {
    const [{ orgId }, supabase] = await Promise.all([getUserAndOrg(), getSupabaseForApp()]);
    const payload = {
      ...mapVehicleToDb(vehicleData),
      org_id: orgId,
    };
    const { data, error } = await supabase.from('haulier_vehicles').insert([payload]).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeVehicleRow(data?.[0]) };
}

export async function updateVehicleAction(vehicleData: HaulierVehicle) {
    const supabase = await getSupabaseForApp();
    const payload = mapVehicleToDb(vehicleData);
    const { data, error } = await supabase.from('haulier_vehicles').update(payload).eq('id', vehicleData.id).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeVehicleRow(data?.[0]) };
}

export async function deleteVehicleAction(vehicleId: string) {
    const supabase = await getSupabaseForApp();
    const { error } = await supabase.from('haulier_vehicles').delete().eq('id', vehicleId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function addVarietyAction(varietyData: Omit<Variety, 'id'>) {
    const [{ orgId }, supabase] = await Promise.all([getUserAndOrg(), getSupabaseForApp()]);
    const payload = {
      ...mapVarietyToDb(varietyData),
      org_id: orgId,
    };
    const { data, error } = await supabase.from('plant_varieties').insert([payload]).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeVarietyRow(data?.[0]) };
}

export async function updateVarietyAction(varietyData: Variety) {
    const supabase = await getSupabaseForApp();
    const payload = mapVarietyToDb(varietyData);
    const { data, error } = await supabase.from('plant_varieties').update(payload).eq('id', varietyData.id).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeVarietyRow(data?.[0]) };
}

export async function deleteVarietyAction(varietyId: string) {
    const supabase = await getSupabaseForApp();

    // First, try to delete any SKUs associated with this variety
    const { error: skuError } = await supabase.from('skus').delete().eq('plant_variety_id', varietyId);
    if (skuError) {
        if (skuError.message.includes('foreign key constraint')) {
            // Extract the constraint name to give a better error message
            const constraintMatch = skuError.message.match(/"([^"]+)"/);
            const constraint = constraintMatch?.[1] || '';
            let reason = 'This variety has SKUs that are in use.';
            if (constraint.includes('order')) reason = 'This variety has SKUs used in orders.';
            else if (constraint.includes('invoice')) reason = 'This variety has SKUs used in invoices.';
            else if (constraint.includes('product')) reason = 'This variety has SKUs linked to products.';
            return { success: false, error: reason, canArchive: true };
        }
        return { success: false, error: skuError.message };
    }

    // Now delete the variety
    const { error } = await supabase.from('plant_varieties').delete().eq('id', varietyId);
    if (error) {
        if (error.message.includes('foreign key constraint')) {
            const constraintMatch = error.message.match(/"([^"]+)"/);
            const constraint = constraintMatch?.[1] || '';
            let reason = 'This variety is in use elsewhere.';
            if (constraint.includes('batch')) reason = 'This variety is used in batches.';
            else if (constraint.includes('trial')) reason = 'This variety is used in trials.';
            else if (constraint.includes('sku')) reason = 'This variety has SKUs.';
            else if (constraint.includes('plan')) reason = 'This variety is used in production plans.';
            return { success: false, error: reason, canArchive: true };
        }
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function archiveVarietyAction(varietyId: string) {
    const supabase = await getSupabaseForApp();
    const { error } = await supabase
        .from('plant_varieties')
        .update({ is_archived: true })
        .eq('id', varietyId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function unarchiveVarietyAction(varietyId: string) {
    const supabase = await getSupabaseForApp();
    const { error } = await supabase
        .from('plant_varieties')
        .update({ is_archived: false })
        .eq('id', varietyId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function askIntelligenceAction(query: string) {
  try {
    const { askNurseryIntelligence } = await import('@/ai/flows/nursery-intelligence');
    const response = await askNurseryIntelligence(query);
    return { success: true, data: response };
  } catch (error: any) {
    logError('[askIntelligenceAction] error', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error.message || 'Failed to get a response from AI.' };
  }
}
