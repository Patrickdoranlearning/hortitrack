
'use server';

import { productionProtocol } from '@/ai/flows/production-protocol';
import { careRecommendations, type CareRecommendationsInput } from '@/ai/flows/care-recommendations';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import type { Batch } from '@/lib/types';
import { supabaseServer } from '@/server/supabase/client';
import { z } from 'zod';
import { declassify } from '@/server/utils/declassify';
import { snakeToCamel } from '@/lib/utils'; // Import snakeToCamel

// Helper to transform Supabase data to Batch type, including joined variety data
function transformBatchData(data: any): Batch {
    console.log('[transformBatchData] Raw data received for transformation:', data); // Added log
    const camelCaseData = snakeToCamel(data);

    // Supabase often returns the joined object under the foreign key name (camelCased)
    // So, plant_varieties data will likely be under 'plantVarietyId' or 'plantVarieties'
    // Let's assume it's directly under 'plantVariety' (camelCase of plant_varieties table name)
    // or the foreign key name 'plantVarietyId'
    const plantVarietyData = camelCaseData.plantVarieties || camelCaseData.plantVariety; // Try both possible inferred names

    return {
        ...camelCaseData,
        plantVariety: plantVarietyData?.name || camelCaseData.plantVariety || '', 
        plantFamily: plantVarietyData?.family || camelCaseData.plantFamily || '',
    };
}

async function getBatchById(batchId: string): Promise<Batch | null> {
    const supabase = await supabaseServer();
    console.log(`[getBatchById] Fetching batch with ID: ${batchId}`); // Added logging
    const { data, error } = await supabase
        .from('batches')
        .select('*, plant_varieties(name, family)') // Use the table name directly for join
        .eq('id', batchId)
        .single();
    
    if (error) {
        console.error('[getBatchById] Supabase error:', error); // Added logging
        return null;
    }
    console.log('[getBatchById] Raw Supabase data:', data); // Added logging
    return transformBatchData(data) as Batch | null; // Use the transformation
}

export async function getBatchesAction() {
    try {
        const supabase = await supabaseServer();
        console.log('[getBatchesAction] Fetching all batches with variety join'); // Added logging
        const { data: batches, error } = await supabase
            .from('batches')
            .select('*, plant_varieties(name, family)') // Use the table name directly for join
            .order('plantingDate', { ascending: false });

        if (error) {
            console.error('[getBatchesAction] Supabase error:', error); // More verbose logging
            throw error;
        }
        console.log('[getBatchesAction] Raw Supabase data (before transform):', batches); // Added logging
        
        // Transform each batch item
        const transformedBatches = (batches || []).map(transformBatchData);
        
        return { success: true, data: declassify(transformedBatches) as Batch[] };
    } catch (error: any) {
        console.error('[getBatchesAction] Error in action:', error); // More verbose logging
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
