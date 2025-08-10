
'use server';

import { careRecommendations } from '@/ai/flows/care-recommendations';
import { productionProtocol } from '@/ai/flows/production-protocol';
import { batchChat } from '@/ai/flows/batch-chat-flow';
import type { Batch } from '@/lib/types';
import { promises as fs } from 'fs';
import { join } from 'path';

const dataFilePath = join(process.cwd(), 'src', 'lib', 'data.json');

async function readData(): Promise<Batch[]> {
  try {
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading data file:', error);
    return [];
  }
}

async function writeData(data: Batch[]): Promise<void> {
  try {
    await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing data file:', error);
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
    const batches = await readData();
    return { success: true, data: batches };
  } catch (error) {
    console.error('Error getting batches:', error);
    return { success: false, error: 'Failed to get batches.' };
  }
}

export async function addBatchAction(
  newBatchData: Omit<Batch, 'id' | 'logHistory'>
) {
  try {
    const batches = await readData();
    const newBatch: Batch = {
      ...newBatchData,
      id: Date.now().toString(),
      logHistory: [{ date: new Date().toISOString(), action: 'Batch created.' }],
    };
    batches.push(newBatch);
    await writeData(batches);
    return { success: true, data: newBatch };
  } catch (error) {
    console.error('Error adding batch:', error);
    return { success: false, error: 'Failed to add batch.' };
  }
}

export async function updateBatchAction(batchToUpdate: Batch) {
  try {
    let batches = await readData();
    batches = batches.map((b) => (b.id === batchToUpdate.id ? batchToUpdate : b));
    await writeData(batches);
    return { success: true, data: batchToUpdate };
  } catch (error) {
    console.error('Error updating batch:', error);
    return { success: false, error: 'Failed to update batch.' };
  }
}

async function getBatchById(batchId: string): Promise<Batch | null> {
    const batches = await readData();
    return batches.find(b => b.id === batchId) || null;
}


export async function logAction(batchId: string, action: string, quantityChange: number | null = null, newLocation: string | null = null) {
  try {
    const batch = await getBatchById(batchId);
    if (!batch) {
      return { success: false, error: 'Batch not found.' };
    }
    
    const updatedBatch = { ...batch };

    updatedBatch.logHistory = [...updatedBatch.logHistory, { date: new Date().toISOString(), action }];

    if (quantityChange !== null) {
      updatedBatch.quantity += quantityChange;
    }
    
    if (newLocation !== null) {
        updatedBatch.location = newLocation;
    }

    const result = await updateBatchAction(updatedBatch);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error logging action:', error);
    return { success: false, error: 'Failed to log action.' };
  }
}

export async function archiveBatchAction(batchId: string, loss: number) {
  try {
    const batch = await getBatchById(batchId);
    if (!batch) {
      return { success: false, error: 'Batch not found.' };
    }
    
    const updatedBatch = { ...batch };
    
    updatedBatch.status = 'Archived';
    const action = `Archived with loss of ${loss} units. Final quantity: ${batch.quantity - loss}.`;
    updatedBatch.logHistory.push({ date: new Date().toISOString(), action });
    updatedBatch.quantity = 0;

    const result = await updateBatchAction(updatedBatch);
    if (result.success) {
        return { success: true, data: result.data };
    } else {
        return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error archiving batch:', error);
    return { success: false, error: 'Failed to archive batch.' };
  }
}

export async function transplantBatchAction(
  sourceBatchId: string,
  newBatchData: Omit<Batch, 'id' | 'logHistory' | 'transplantedFrom' | 'batchNumber'>,
  transplantQuantity: number,
  logRemainingAsLoss: boolean
) {
  try {
    const allBatches = await readData();
    const sourceBatch = allBatches.find(b => b.id === sourceBatchId);

    if (!sourceBatch) {
      throw new Error('Source batch not found.');
    }

    if (sourceBatch.quantity < transplantQuantity) {
      throw new Error('Insufficient quantity in source batch.');
    }
    
    const maxBatchNum = allBatches.reduce((max, b) => {
        const numPart = parseInt(b.batchNumber.split('-')[1] || '0', 10);
        return numPart > max ? numPart : max;
    }, 0);
    const nextBatchNumStr = (maxBatchNum + 1).toString().padStart(6, '0');

    const batchNumberPrefix = {
        'Propagation': '1',
        'Plugs/Liners': '2',
        'Potted': '3',
        'Ready for Sale': '4',
        'Looking Good': '6',
        'Archived': '5'
    };
    const prefixedBatchNumber = `${batchNumberPrefix[newBatchData.status]}-${nextBatchNumStr}`;

    const newBatch: Batch = {
      ...(newBatchData as any),
      id: Date.now().toString(),
      batchNumber: prefixedBatchNumber,
      initialQuantity: transplantQuantity,
      quantity: transplantQuantity,
      transplantedFrom: sourceBatch.batchNumber,
      logHistory: [
        {
          date: new Date().toISOString(),
          action: `Created from transplant of ${transplantQuantity} units from batch ${sourceBatch.batchNumber}.`,
        },
      ],
    };

    sourceBatch.logHistory.push({
      date: new Date().toISOString(),
      action: `Transplanted ${transplantQuantity} units to new batch ${newBatch.batchNumber}.`,
    });

    if (logRemainingAsLoss) {
      const remaining = sourceBatch.quantity - transplantQuantity;
      if (remaining > 0) {
        sourceBatch.logHistory.push({
            date: new Date().toISOString(),
            action: `Archived with loss of ${remaining} units.`
        });
      }
      sourceBatch.status = 'Archived';
      sourceBatch.quantity = 0;
    } else {
        sourceBatch.quantity -= transplantQuantity;
    }

    const updatedBatches = allBatches.map(b => b.id === sourceBatchId ? sourceBatch : b);
    updatedBatches.push(newBatch);
    await writeData(updatedBatches);
    
    return { success: true, data: { sourceBatch, newBatch } };

  } catch (error: any) {
    console.error('Error transplanting batch:', error);
    return { success: false, error: error.message || 'Failed to transplant batch.' };
  }
}

export async function batchChatAction(batch: Batch, query: string) {
    try {
      const result = await batchChat({ batch, query });
      return { success: true, data: result };
    } catch (error) {
      console.error('Error in batch chat action:', error);
      return { success: false, error: 'Failed to get AI chat response.' };
    }
}
