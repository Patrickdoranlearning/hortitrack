
'use server';

import { careRecommendations, type CareRecommendationsInput } from '@/ai/flows/care-recommendations';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import type { Batch, Customer, Haulier, NurseryLocation, PlantSize, Supplier, Variety } from '@/lib/types';
import { getSupabaseServerApp, getSupabaseServerClient } from '@/server/db/supabase';
import { z } from 'zod';
import { declassify } from '@/server/utils/declassify';
import { snakeToCamel } from '@/lib/utils';
import { getUserAndOrg } from '@/server/auth/org';

async function getSupabaseForApp() {
  return getSupabaseServerClient();
}

function transformVBatchSearchData(data: any): Batch {
    const camelCaseData = snakeToCamel(data);
    return {
        ...camelCaseData,
        batchNumber: camelCaseData.batchNumber,
        plantVariety: camelCaseData.varietyName ?? '',
        plantFamily: camelCaseData.varietyFamily ?? null,
        size: camelCaseData.sizeName ?? '',
        location: camelCaseData.locationName ?? null,
        supplier: camelCaseData.supplierName ?? null,
        initialQuantity: camelCaseData.initialQuantity ?? camelCaseData.quantity ?? 0,
        plantedAt: camelCaseData.plantedAt ?? camelCaseData.createdAt, 
        plantingDate: camelCaseData.plantedAt ?? camelCaseData.createdAt, 
        category: camelCaseData.category ?? '',
        createdAt: camelCaseData.createdAt,
        updatedAt: camelCaseData.updatedAt,
        logHistory: [], 
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
        console.error('[getBatchById] Supabase error from v_batch_search:', error);
        return null;
    }
    return data ? transformVBatchSearchData(data) : null;
}

const plantSizeColumnMap = {
  camel: [
    'id',
    'name',
    'containerType',
    'cellMultiple',
    'shelfQuantity',
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
    'shelf_quantity',
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
  camel: ['id', 'orgId', 'siteId', 'name', 'nurserySite', 'covered', 'area', 'type'] as const,
  snake: ['id', 'org_id', 'site_id', 'name', 'nursery_site', 'covered', 'area', 'type'] as const,
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

export async function getBatchesAction() {
    try {
        const supabase = await getSupabaseForApp();
        const { data: batches, error } = await supabase
            .from("v_batch_search") 
            .select("*") 
            .order("created_at", { ascending: false });

        if (error) {
            console.error('[getBatchesAction] Supabase error from v_batch_search:', error);
            throw error;
        }
        
        const transformedBatches = (batches || []).map(transformVBatchSearchData);
        
        return { success: true, data: declassify(transformedBatches) as Batch[] };
    } catch (error: any) {
        console.error('[getBatchesAction] Error in action:', error);
        return { success: false, error: 'Failed to fetch batches: ' + error.message };
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
    console.error('Error getting production protocol:', error);
    return {
      success: false,
      error: 'Failed to generate AI production protocol.',
    };
  }
}

export async function getCareRecommendationsAction(batchId: string) {
  try {
    const batch = await getBatchById(batchId);
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
    };
    const recommendations = await careRecommendations(input);
    return { success: true, data: recommendations };
  } catch (error: any) {
    console.error('Error getting care recommendations:', error);
    return {
      success: false,
      error: 'Failed to generate AI care recommendations.',
    };
  }
}

export async function batchChatAction(batchId: string, query: string) {
  try {
    const batch = await getBatchById(batchId);
    if (!batch) {
        return { success: false, error: 'Batch not found.' };
    }
    const input: BatchChatInput = { batch, query };
    const result = await batchChat(input);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error in batch chat action:', error);
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
    const { error } = await supabase.from('hauliers').delete().eq('id', haulierId);
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
    const { error } = await supabase.from('plant_varieties').delete().eq('id', varietyId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}
