
'use server';

import { productionProtocol } from '@/ai/flows/production-protocol';
import { careRecommendations, type CareRecommendationsInput, type CareRecommendationsOutput } from '@/ai/flows/care-recommendations';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import type { Batch, Variety } from '@/lib/types';
import { db } from '@/lib/firebase-admin';
import { z } from 'zod';

export async function getBatchesAction() {
    try {
        const snapshot = await db.collection('batches').get();
        const batches = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Batch[];
        return { success: true, data: batches };
    } catch (error: any) {
        console.error('Error getting batches:', error);
        return { success: false, error: 'Failed to fetch batches: ' + error.message };
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

export async function getCareRecommendationsAction(batch: Batch) {
  try {
    const input: CareRecommendationsInput = {
      batchInfo: {
        plantFamily: batch.plantFamily,
        plantVariety: batch.plantVariety,
        plantingDate: batch.plantingDate,
      },
      logHistory: batch.logHistory.map((log: any) => log.note || log.type),
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

export async function batchChatAction(batch: Batch, query: string) {
  try {
    const input: BatchChatInput = { batch, query };
    const result = await batchChat(input);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error in batch chat action:', error);
    return { success: false, error: 'Failed to get AI response.' };
  }
}

export async function addVarietyAction(varietyData: Omit<Variety, 'id'>) {
    try {
        const docRef = db.collection('varieties').doc();
        const newVariety = {
            ...varietyData,
            id: docRef.id,
        };
        await docRef.set(newVariety);
        return { success: true, data: newVariety };
    } catch (error: any) {
        console.error('Error adding variety:', error);
        return { success: false, error: 'Failed to add variety: ' + error.message };
    }
}


export async function addBatchAction(
  newBatchData: Omit<Batch, 'id' | 'logHistory'>
) {
  try {
    const batchesCollection = db.collection('batches');
    const newDocRef = batchesCollection.doc();
    const newBatch: Batch = {
      ...newBatchData,
      id: newDocRef.id,
      logHistory: [{ id: `log_${Date.now()}`, date: new Date().toISOString(), type: 'CREATE', note: 'Batch created.' }],
    };
    await newDocRef.set(newBatch);
    return { success: true, data: newBatch };
  } catch (error: any) {
    console.error('Error adding batch:', error);
    return { success: false, error: 'Failed to add batch: ' + error.message };
  }
}

export async function updateBatchAction(batchToUpdate: Batch) {
  try {
    const updatedBatchData = { ...batchToUpdate };

    if (updatedBatchData.quantity <= 0 && updatedBatchData.status !== 'Archived') {
      updatedBatchData.logHistory.push({ id: `log_${Date.now()}`, date: new Date().toISOString(), type: 'ARCHIVE', note: `Batch quantity reached zero and was automatically archived.` });
      updatedBatchData.status = 'Archived';
    }
    
    if (updatedBatchData.status === 'Archived') {
        updatedBatchData.quantity = 0;
    }


    const batchesCollection = db.collection('batches');
    const batchDoc = batchesCollection.doc(updatedBatchData.id!);
    await batchDoc.set(updatedBatchData, { merge: true });
    return { success: true, data: updatedBatchData };
  } catch (error: any) {
    console.error('Error updating batch:', error);
    return { success: false, error: 'Failed to update batch: ' + error.message };
  }
}

async function getBatchById(batchId: string): Promise<Batch | null> {
    const docRef = db.collection('batches').doc(batchId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
        return { ...docSnap.data(), id: docSnap.id } as Batch;
    }
    return null;
}


export async function logAction(batchId: string, logData: { type: string; note: string; qty?: number; reason?: string; newLocation?: string; }) {
  try {
    const batch = await getBatchById(batchId);
    if (!batch) {
      return { success: false, error: 'Batch not found.' };
    }
    
    const updatedBatch = { ...batch };

    updatedBatch.logHistory = [...updatedBatch.logHistory, { id: `log_${Date.now()}`, date: new Date().toISOString(), ...logData }];

    if (logData.qty && (logData.type === 'LOSS' || logData.type === 'ADJUST')) {
      updatedBatch.quantity += logData.qty;
    }
    
    if (logData.newLocation && logData.type === 'MOVE') {
        updatedBatch.location = logData.newLocation;
    }

    const result = await updateBatchAction(updatedBatch);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('Error logging action:', error);
    return { success: false, error: 'Failed to log action: ' + error.message };
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
    const note = `Archived with loss of ${loss} units. Final quantity: ${batch.quantity - loss}.`;
    updatedBatch.logHistory.push({ id: `log_${Date.now()}`, date: new Date().toISOString(), type: 'ARCHIVE', note });
    updatedBatch.quantity = 0;

    const result = await updateBatchAction(updatedBatch);
    if (result.success) {
        return { success: true, data: result.data };
    } else {
        return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('Error archiving batch:', error);
    return { success: false, error: 'Failed to archive batch: ' + error.message };
  }
}

export async function transplantBatchAction(
  sourceBatchId: string,
  newBatchData: Omit<Batch, 'id' | 'logHistory' | 'transplantedFrom' | 'batchNumber'>,
  transplantQuantity: number,
  logRemainingAsLoss: boolean
) {
  try {
    return await db.runTransaction(async (transaction) => {
        const sourceBatchRef = db.collection('batches').doc(sourceBatchId);
        const sourceBatchDoc = await transaction.get(sourceBatchRef);

        if (!sourceBatchDoc.exists) {
            throw new Error('Source batch not found.');
        }
        const sourceBatch = { ...sourceBatchDoc.data(), id: sourceBatchDoc.id } as Batch;

        if (sourceBatch.quantity < transplantQuantity) {
            throw new Error('Insufficient quantity in source batch.');
        }

        const allBatchesSnapshot = await transaction.get(db.collection('batches'));
        const maxBatchNum = allBatchesSnapshot.docs.reduce((max, doc) => {
            const b = doc.data() as Batch;
            const numPart = parseInt(b.batchNumber.split('-')[1] || '0', 10);
            return numPart > max ? numPart : max;
        }, 0);
        const nextBatchNumStr = (maxBatchNum + 1).toString().padStart(6, '0');

        const batchNumberPrefix: Record<string, string> = {
            'Propagation': '1', 'Plugs/Liners': '2', 'Potted': '3',
            'Ready for Sale': '4', 'Looking Good': '6', 'Archived': '5'
        };
        const prefixedBatchNumber = `${batchNumberPrefix[newBatchData.status]}-${nextBatchNumStr}`;

        const newDocRef = db.collection('batches').doc();
        const newBatch: Batch = {
            ...(newBatchData as any),
            id: newDocRef.id,
            batchNumber: prefixedBatchNumber,
            initialQuantity: transplantQuantity,
            quantity: transplantQuantity,
            transplantedFrom: sourceBatch.batchNumber,
            logHistory: [
                {
                id: `log_${Date.now()}`,
                date: new Date().toISOString(),
                type: 'TRANSPLANT_FROM',
                note: `Created from transplant of ${transplantQuantity} units from batch ${sourceBatch.batchNumber}.`,
                },
            ],
        };

        const updatedSourceBatch = { ...sourceBatch };
        updatedSourceBatch.logHistory.push({
            id: `log_${Date.now()}`,
            date: new Date().toISOString(),
            type: 'TRANSPLANT_TO',
            note: `Transplanted ${transplantQuantity} units to new batch ${newBatch.batchNumber}.`,
        });

        if (logRemainingAsLoss) {
            const remaining = sourceBatch.quantity - transplantQuantity;
            if (remaining > 0) {
            updatedSourceBatch.logHistory.push({
                    id: `log_${Date.now()}`,
                    date: new Date().toISOString(),
                    type: 'LOSS',
                    note: `Archived with loss of ${remaining} units.`
                });
            }
            updatedSourceBatch.status = 'Archived';
            updatedSourceBatch.quantity = 0;
        } else {
            updatedSourceBatch.quantity -= transplantQuantity;
        }
        
        transaction.set(newDocRef, newBatch);
        
        if (updatedSourceBatch.quantity <= 0 && updatedSourceBatch.status !== 'Archived') {
            updatedSourceBatch.logHistory.push({ id: `log_${Date.now()}`, date: new Date().toISOString(), type: 'ARCHIVE', note: `Batch quantity reached zero and was automatically archived.` });
            updatedSourceBatch.status = 'Archived';
            updatedSourceBatch.quantity = 0;
        }
        transaction.set(sourceBatchRef, updatedSourceBatch);
        
        return { success: true, data: { sourceBatch: updatedSourceBatch, newBatch } };
    });

  } catch (error: any) {
    console.error('Error transplanting batch:', error);
    return { success: false, error: error.message || 'Failed to transplant batch.' };
  }
}
