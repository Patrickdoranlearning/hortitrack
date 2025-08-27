
'use server';

import { productionProtocol } from '@/ai/flows/production-protocol';
import { careRecommendations, type CareRecommendationsInput } from '@/ai/flows/care-recommendations';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import type { Batch } from '@/lib/types';
import { supabaseServer } from '@/server/supabase/client';
import { z } from 'zod';
import { declassify } from '@/server/utils/declassify';
import { snakeToCamel } from '@/lib/utils'; // Import snakeToCamel

// Helper to transform Supabase v_batch_search data to Batch type
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
        // Ensure other necessary Batch properties are mapped or defaulted
        initialQuantity: camelCaseData.initialQuantity ?? camelCaseData.quantity ?? 0,
        plantedAt: camelCaseData.plantedAt ?? camelCaseData.createdAt, // Use plantedAt from view, fallback to createdAt
        plantingDate: camelCaseData.plantedAt ?? camelCaseData.createdAt, // For compatibility
        category: camelCaseData.category ?? '', // If category is in the view, use it, else default
        createdAt: camelCaseData.createdAt,
        updatedAt: camelCaseData.updatedAt,
        logHistory: [], // v_batch_search doesn't include full log history, default to empty
        // Add other defaults as needed based on the Batch type
    };
}

// This is now fetching from v_batch_search
async function getBatchById(batchId: string): Promise<Batch | null> {
    const supabase = await supabaseServer();
    console.log(`[getBatchById] Fetching batch with ID from v_batch_search: ${batchId}`);
    const { data, error } = await supabase
        .from("v_batch_search") // Query the view
        .select("*") // Select all flattened columns from the view
        .eq("id", batchId)
        .maybeSingle();
    
    if (error) {
        console.error('[getBatchById] Supabase error from v_batch_search:', error);
        return null;
    }
    console.log('[getBatchById] Raw Supabase data from v_batch_search:', data);
    return data ? transformVBatchSearchData(data) : null;
}

export async function getBatchesAction() {
    try {
        const supabase = await supabaseServer();
        console.log('[getBatchesAction] Fetching all batches from v_batch_search');
        const { data: batches, error } = await supabase
            .from("v_batch_search") // Query the view
            .select("*") // Select all flattened columns from the view
            .order("created_at", { ascending: false });

        if (error) {
            console.error('[getBatchesAction] Supabase error from v_batch_search:', error);
            throw error;
        }
        console.log('[getBatchesAction] Raw Supabase data from v_batch_search (before transform):', batches);
        
        const transformedBatches = (batches || []).map(transformVBatchSearchData);
        
        return { success: true, data: declassify(transformedBatches) as Batch[] };
    } catch (error: any) {
        console.error('[getBatchesAction] Error in action:', error);
        return { success: false, error: 'Failed to fetch batches: ' + error.message };
    }
}

export async function getProductionProtocolAction(batchId: string) {
  try {
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
