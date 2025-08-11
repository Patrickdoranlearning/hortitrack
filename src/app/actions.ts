'use server';

import { careRecommendations } from '@/ai/flows/care-recommendations';
import { productionProtocol } from '@/ai/flows/production-protocol';
import { batchChat } from '@/ai/flows/batch-chat-flow';
import type { Batch } from '@/lib/types';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getFirestore } from '@genkit-ai/firebase';
import { collection, doc, getDocs, setDoc, writeBatch, query } from 'firebase/firestore';

async function getBatchesCollection() {
    const db = getFirestore();
    return collection(db, 'batches');
}

async function migrateData() {
    console.log("Checking if data migration is needed...");
    const db = getFirestore();
    const batchesRef = collection(db, 'batches');
    const snapshot = await getDocs(query(batchesRef));

    if (snapshot.empty) {
        console.log("No batches found in Firestore. Migrating from data.json...");
        const dataFilePath = join(process.cwd(), 'src', 'lib', 'data.json');
        try {
            const fileContent = await fs.readFile(dataFilePath, 'utf-8');
            const batches: Batch[] = JSON.parse(fileContent);
            
            const firestoreBatch = writeBatch(db);
            batches.forEach(batch => {
                const docRef = doc(batchesRef, batch.id);
                firestoreBatch.set(docRef, batch);
            });
            
            await firestoreBatch.commit();
            console.log(`Successfully migrated ${batches.length} batches to Firestore.`);

            await fs.rename(dataFilePath, dataFilePath + '.migrated');
            console.log("Renamed data.json to data.json.migrated");

        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                 console.log("data.json not found, assuming already migrated.");
            } else {
                console.error('Error during data migration:', error);
            }
        }
    } else {
        console.log("Firestore already contains data. Skipping migration.");
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
    await migrateData();
    const batchesCollection = await getBatchesCollection();
    const snapshot = await getDocs(batchesCollection);
    const batches = snapshot.docs.map(doc => doc.data() as Batch);
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
    const batchesCollection = await getBatchesCollection();
    const newDocRef = doc(batchesCollection);
    const newBatch: Batch = {
      ...newBatchData,
      id: newDocRef.id,
      logHistory: [{ date: new Date().toISOString(), action: 'Batch created.' }],
    };
    await setDoc(newDocRef, newBatch);
    return { success: true, data: newBatch };
  } catch (error) {
    console.error('Error adding batch:', error);
    return { success: false, error: 'Failed to add batch.' };
  }
}

export async function updateBatchAction(batchToUpdate: Batch) {
  try {
    const batchesCollection = await getBatchesCollection();
    const batchDoc = doc(batchesCollection, batchToUpdate.id);
    await setDoc(batchDoc, batchToUpdate, { merge: true });
    return { success: true, data: batchToUpdate };
  } catch (error) {
    console.error('Error updating batch:', error);
    return { success: false, error: 'Failed to update batch.' };
  }
}

async function getBatchById(batchId: string): Promise<Batch | null> {
    const db = getFirestore();
    const docRef = doc(db, 'batches', batchId);
    const docSnap = await getDocs(query(collection(db, 'batches'), where('id', '==', batchId)));

    if (!docSnap.empty) {
        return docSnap.docs[0].data() as Batch;
    }
    return null;
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
    const db = getFirestore();
    const batchesCollection = collection(db, 'batches');

    // Firestore transactions require a different approach than the admin SDK
    // This simplified version will perform writes sequentially.
    // For true atomicity, this would need to be a callable function or more complex setup.

    const sourceBatch = await getBatchById(sourceBatchId);

    if (!sourceBatch) {
      throw new Error('Source batch not found.');
    }

    if (sourceBatch.quantity < transplantQuantity) {
      throw new Error('Insufficient quantity in source batch.');
    }

    // Generate new batch number
    const allBatchesSnapshot = await getDocs(batchesCollection);
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

    const newDocRef = doc(batchesCollection);
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

    const writeOp = writeBatch(db);
    writeOp.set(newDocRef, newBatch);
    writeOp.set(doc(db, 'batches', sourceBatchId), updatedSourceBatch);
    await writeOp.commit();

    return { success: true, data: { sourceBatch: updatedSourceBatch, newBatch } };

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
