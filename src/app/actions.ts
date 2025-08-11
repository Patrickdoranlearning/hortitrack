
'use server';

import { careRecommendations } from '@/ai/flows/care-recommendations';
import { productionProtocol } from '@/ai/flows/production-protocol';
import type { Batch } from '@/lib/types';
import { db } from '@/lib/firebase-admin';

export async function getCareRecommendationsAction(batch: Batch) {
  const runtime = 'nodejs';
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
  const runtime = 'nodejs';
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
  const runtime = 'nodejs';
  try {
    const batchesCollection = db.collection('batches');
    const snapshot = await batchesCollection.where('status', '!=', 'Archived').orderBy('status').orderBy('batchNumber').get();
    const batches = snapshot.docs.map(doc => doc.data() as Batch);
    return { success: true, data: batches };
  } catch (error: any) {
    console.error('Error getting batches:', error);
    return { success: false, error: 'Failed to get batches: ' + error.message };
  }
}

export async function addBatchAction(
  newBatchData: Omit<Batch, 'id' | 'logHistory'>
) {
  const runtime = 'nodejs';
  try {
    const batchesCollection = db.collection('batches');
    const newDocRef = batchesCollection.doc();
    const newBatch: Batch = {
      ...newBatchData,
      id: newDocRef.id,
      logHistory: [{ date: new Date().toISOString(), action: 'Batch created.' }],
    };
    await newDocRef.set(newBatch);
    return { success: true, data: newBatch };
  } catch (error: any) {
    console.error('Error adding batch:', error);
    return { success: false, error: 'Failed to add batch: ' + error.message };
  }
}

export async function updateBatchAction(batchToUpdate: Batch) {
  const runtime = 'nodejs';
  try {
    const batchesCollection = db.collection('batches');
    const batchDoc = batchesCollection.doc(batchToUpdate.id);
    await batchDoc.set(batchToUpdate, { merge: true });
    return { success: true, data: batchToUpdate };
  } catch (error: any) {
    console.error('Error updating batch:', error);
    return { success: false, error: 'Failed to update batch: ' + error.message };
  }
}

async function getBatchById(batchId: string): Promise<Batch | null> {
    const runtime = 'nodejs';
    const docRef = db.collection('batches').doc(batchId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
        return docSnap.data() as Batch;
    }
    return null;
}


export async function logAction(batchId: string, action: string, quantityChange: number | null = null, newLocation: string | null = null) {
  const runtime = 'nodejs';
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
  } catch (error: any) {
    console.error('Error logging action:', error);
    return { success: false, error: 'Failed to log action: ' + error.message };
  }
}

export async function archiveBatchAction(batchId: string, loss: number) {
  const runtime = 'nodejs';
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
  const runtime = 'nodejs';
  try {
    return await db.runTransaction(async (transaction) => {
        const sourceBatchRef = db.collection('batches').doc(sourceBatchId);
        const sourceBatchDoc = await transaction.get(sourceBatchRef);

        if (!sourceBatchDoc.exists) {
            throw new Error('Source batch not found.');
        }
        const sourceBatch = sourceBatchDoc.data() as Batch;

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

        const batchNumberPrefix = {
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
                date: new Date().toISOString(),
                action: `Created from transplant of ${transplantQuantity} units from batch ${sourceBatch.batchNumber}.`,
                },
            ],
        };

        const updatedSourceBatch = { ...sourceBatch };
        updatedSourceBatch.logHistory.push({
            date: new Date().toISOString(),
            action: `Transplanted ${transplantQuantity} units to new batch ${newBatch.batchNumber}.`,
        });

        if (logRemainingAsLoss) {
            const remaining = sourceBatch.quantity - transplantQuantity;
            if (remaining > 0) {
            updatedSourceBatch.logHistory.push({
                    date: new Date().toISOString(),
                    action: `Archived with loss of ${remaining} units.`
                });
            }
            updatedSourceBatch.status = 'Archived';
            updatedSourceBatch.quantity = 0;
        } else {
            updatedSourceBatch.quantity -= transplantQuantity;
        }
        
        transaction.set(newDocRef, newBatch);
        transaction.set(sourceBatchRef, updatedSourceBatch);
        
        return { success: true, data: { sourceBatch: updatedSourceBatch, newBatch } };
    });

  } catch (error: any) {
    console.error('Error transplanting batch:', error);
    return { success: false, error: error.message || 'Failed to transplant batch.' };
  }
}
