
'use server';

import { productionProtocol } from '@/ai/flows/production-protocol';
import { careRecommendations, type CareRecommendationsInput } from '@/ai/flows/care-recommendations';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import type { Batch } from '@/lib/types';
import { supabaseServer } from '@/server/supabase/client';
import { z } from 'zod';
import { declassify } from '@/server/utils/declassify';

async function getBatchById(batchId: string): Promise<Batch | null> {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('id', batchId)
        .single();
    
    if (error) {
        console.error('Error fetching batch by id:', error);
        return null;
    }
    return data as Batch | null;
}

export async function getBatchesAction() {
    try {
        const supabase = await supabaseServer();
        const { data: batches, error } = await supabase
            .from('batches')
            .select('*')
            .order('plantingDate', { ascending: false });

        if (error) throw error;
        
        return { success: true, data: declassify(batches) as Batch[] };
    } catch (error: any) {
        console.error('Error getting batches:', error);
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
        plantingDate: batch.plantingDate,
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
