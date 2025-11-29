
'use server';

import { careRecommendations, type CareRecommendationsInput } from '@/ai/flows/care-recommendations';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import type { Batch, PlantSize } from '@/lib/types';
import { getSupabaseServerApp, getSupabaseServerClient } from '@/server/db/supabase';
import { z } from 'zod';
import { declassify } from '@/server/utils/declassify';
import { snakeToCamel } from '@/lib/utils';

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
    const input: CareRecommendationsInput = {
      batchInfo: {
        plantFamily: batch.plantFamily,
        plantVariety: batch.plantVariety,
        plantingDate: batch.plantedAt ?? batch.plantingDate ?? new Date().toISOString(),
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
    const supabase = await getSupabaseForApp();
    const { data, error } = await supabase.from('nursery_locations').insert([locationData]).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.[0] };
}

export async function updateLocationAction(locationData: NurseryLocation) {
    const supabase = await getSupabaseForApp();
    const { data, error } = await supabase.from('nursery_locations').update(locationData).eq('id', locationData.id).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.[0] };
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
    const supabase = await getSupabaseForApp();
    const { data, error } = await supabase.from('suppliers').insert([supplierData]).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.[0] };
}

export async function updateSupplierAction(supplierData: Supplier) {
    const supabase = await getSupabaseForApp();
    const { data, error } = await supabase.from('suppliers').update(supplierData).eq('id', supplierData.id).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.[0] };
}

export async function deleteSupplierAction(supplierId: string) {
    const supabase = await getSupabaseForApp();
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function addVarietyAction(varietyData: Omit<Variety, 'id'>) {
    const supabase = await getSupabaseForApp();
    const { data, error } = await supabase.from('plant_varieties').insert([varietyData]).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.[0] };
}

export async function updateVarietyAction(varietyData: Variety) {
    const supabase = await getSupabaseForApp();
    const { data, error } = await supabase.from('plant_varieties').update(varietyData).eq('id', varietyData.id).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.[0] };
}

export async function deleteVarietyAction(varietyId: string) {
    const supabase = await getSupabaseForApp();
    const { error } = await supabase.from('plant_varieties').delete().eq('id', varietyId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}
