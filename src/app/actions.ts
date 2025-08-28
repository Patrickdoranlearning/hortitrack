
'use server';

import { productionProtocol } from '@/ai/flows/production-protocol';
import { careRecommendations, type CareRecommendationsInput } from '@/ai/flows/care-recommendations';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import type { Batch } from '@/lib/types';
import { createSupabaseServerWithCookies, type CookieBridge } from '@/server/db/supabaseServerApp';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { declassify } from '@/server/utils/declassify';
import { snakeToCamel } from '@/lib/utils';

function getSupabaseForApp() {
  const store = cookies();
  const cookieBridge: CookieBridge = {
    get: (n) => store.get(n)?.value,
    set: (n, v, o) => store.set(n, v, o),
    remove: (n, o) => store.set(n, "", { ...o, maxAge: 0 }),
  };
  return createSupabaseServerWithCookies(cookieBridge);
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
    const supabase = getSupabaseForApp();
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

export async function getBatchesAction() {
    try {
        const supabase = getSupabaseForApp();
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
