'use server';

import { careRecommendations } from '@/ai/flows/care-recommendations';
import { productionProtocol } from '@/ai/flows/production-protocol';
import type { Batch } from '@/lib/types';
import { promises as fs } from 'fs';
import { join } from 'path';

const dataFilePath = join(process.cwd(), 'src', 'lib', 'data.json');

async function getBatches(): Promise<Batch[]> {
  try {
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    return JSON.parse(fileContent) as Batch[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    console.error('Error reading data file:', error);
    throw new Error('Could not read data file.');
  }
}

async function saveBatches(batches: Batch[]) {
  try {
    const data = JSON.stringify(batches, null, 2);
    await fs.writeFile(dataFilePath, data, 'utf-8');
  } catch (error) {
    console.error('Error saving data file:', error);
    throw new Error('Could not save data file.');
  }
}

export async function getCareRecommendationsAction(batch: Batch) {
  try {
    const logHistoryStrings = batch.logHistory.map(
      (log) => `${log.action} on ${new Date(log.date).toLocaleDateString()}`
    );

    const weatherInfo = {
      temperature: 22,
      humidity: 65,
    };

    const recommendations = await careRecommendations({
      batchInfo: {
        plantFamily: batch.plantFamily,
        plantVariety: batch.plantVariety,
        plantingDate: batch.plantingDate,
      },
      logHistory: logHistoryStrings,
      weatherInfo: weatherInfo,
    });
    return { success: true, data: recommendations };
  } catch (error) {
    console.error('Error getting care recommendations:', error);
    return { success: false, error: 'Failed to get AI recommendations.' };
  }
}

export async function getProductionProtocolAction(batch: Batch) {
  try {
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

export async function getBatchesAction(): Promise<{
  success: boolean;
  data?: Batch[];
  error?: string;
}> {
  try {
    const batches = await getBatches();
    return { success: true, data: batches };
  } catch (error) {
    console.error('Error getting batches:', error);
    return { success: false, error: 'Failed to get batches.' };
  }
}

export async function addBatchAction(
  newBatch: Omit<Batch, 'id' | 'logHistory'>
) {
  try {
    const batches = await getBatches();
    const batchWithId: Batch = {
      ...newBatch,
      id: Date.now().toString(),
      logHistory: [{ date: new Date().toISOString(), action: 'Batch created.' }],
    };
    const updatedBatches = [...batches, batchWithId];
    await saveBatches(updatedBatches);
    return { success: true, data: batchWithId };
  } catch (error) {
    console.error('Error adding batch:', error);
    return { success: false, error: 'Failed to add batch.' };
  }
}

export async function updateBatchAction(updatedBatch: Batch) {
  try {
    const batches = await getBatches();
    const index = batches.findIndex((b) => b.id === updatedBatch.id);
    if (index === -1) {
      return { success: false, error: 'Batch not found.' };
    }
    batches[index] = updatedBatch;
    await saveBatches(batches);
    return { success: true, data: updatedBatch };
  } catch (error) {
    console.error('Error updating batch:', error);
    return { success: false, error: 'Failed to update batch.' };
  }
}

export async function logAction(batchId: string, action: string) {
  try {
    const batches = await getBatches();
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) {
      return { success: false, error: 'Batch not found.' };
    }
    batch.logHistory.push({ date: new Date().toISOString(), action });

    const quantityMatch = action.match(/Adjusted quantity by (-?\d+)/);
    if (quantityMatch) {
      const change = parseInt(quantityMatch[1], 10);
      batch.quantity += change;
    }

    await saveBatches(batches);
    return { success: true, data: batch };
  } catch (error) {
    console.error('Error logging action:', error);
    return { success: false, error: 'Failed to log action.' };
  }
}

export async function archiveBatchAction(batchId: string, loss: number) {
  try {
    const batches = await getBatches();
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) {
      return { success: false, error: 'Batch not found.' };
    }
    batch.status = 'Archived';
    const action = `Archived with loss of ${loss} units. Final quantity: ${batch.quantity}.`;
    batch.logHistory.push({ date: new Date().toISOString(), action });

    await saveBatches(batches);
    return { success: true, data: batch };
  } catch (error) {
    console.error('Error archiving batch:', error);
    return { success: false, error: 'Failed to archive batch.' };
  }
}

export async function transplantBatchAction(
  sourceBatchId: string,
  newBatchData: Omit<Batch, 'id' | 'logHistory' | 'transplantedFrom'>,
  transplantQuantity: number
) {
  try {
    const batches = await getBatches();
    const sourceBatch = batches.find((b) => b.id === sourceBatchId);
    if (!sourceBatch) {
      return { success: false, error: 'Source batch not found.' };
    }

    if (sourceBatch.quantity < transplantQuantity) {
      return { success: false, error: 'Insufficient quantity in source batch.' };
    }

    sourceBatch.quantity -= transplantQuantity;
    sourceBatch.logHistory.push({
      date: new Date().toISOString(),
      action: `Transplanted ${transplantQuantity} units to new batch.`,
    });

    const newBatch: Batch = {
      ...newBatchData,
      id: Date.now().toString(),
      initialQuantity: transplantQuantity,
      quantity: transplantQuantity,
      transplantedFrom: sourceBatchId,
      logHistory: [
        {
          date: new Date().toISOString(),
          action: `Created from transplant of ${transplantQuantity} units from batch ${sourceBatch.batchNumber}.`,
        },
      ],
    };

    const updatedBatches = [...batches, newBatch];
    await saveBatches(updatedBatches);

    return { success: true, data: { sourceBatch, newBatch } };
  } catch (error) {
    console.error('Error transplanting batch:', error);
    return { success: false, error: 'Failed to transplant batch.' };
  }
}
