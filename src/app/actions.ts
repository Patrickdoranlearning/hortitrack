'use server';

import { careRecommendations } from '@/ai/flows/care-recommendations';
import { productionProtocol } from '@/ai/flows/production-protocol';
import { batchChat } from '@/ai/flows/batch-chat-flow';
import type { Batch } from '@/lib/types';
import { promises as fs } from 'fs';
import { join } from 'path';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, addDoc, updateDoc, writeBatch } from 'firebase/firestore';

const dataFilePath = join(process.cwd(), 'src', 'lib', 'data.json');

async function seedData() {
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    const batchesFromFile = JSON.parse(fileContent) as Batch[];

    const firestoreBatch = writeBatch(db);
    batchesFromFile.forEach((batch) => {
        // Use the existing ID from the file for the document ID in Firestore
        const docRef = doc(db, 'batches', batch.id);
        firestoreBatch.set(docRef, batch);
    });
    await firestoreBatch.commit();
    console.log('Successfully seeded data to Firestore.');
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
    const batchesCollection = collection(db, 'batches');
    const snapshot = await getDocs(batchesCollection);

    if (snapshot.empty) {
        // If the collection is empty, seed it from the local file
        await seedData();
        // Re-fetch after seeding
        const seededSnapshot = await getDocs(batchesCollection);
        const batches = seededSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Batch));
        return { success: true, data: batches };
    }

    const batches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Batch));
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
    const batchWithHistory = {
      ...newBatch,
      logHistory: [{ date: new Date().toISOString(), action: 'Batch created.' }],
    }
    const docRef = await addDoc(collection(db, "batches"), batchWithHistory);
    const batchWithId: Batch = {
        ...batchWithHistory,
        id: docRef.id,
    }
    await updateDoc(docRef, { id: docRef.id }); // Add the ID to the document itself
    
    return { success: true, data: batchWithId };
  } catch (error) {
    console.error('Error adding batch:', error);
    return { success: false, error: 'Failed to add batch.' };
  }
}

export async function updateBatchAction(updatedBatch: Batch) {
  try {
    const batchRef = doc(db, "batches", updatedBatch.id);
    await setDoc(batchRef, updatedBatch, { merge: true });
    return { success: true, data: updatedBatch };
  } catch (error) {
    console.error('Error updating batch:', error);
    return { success: false, error: 'Failed to update batch.' };
  }
}

async function getBatchById(batchId: string): Promise<Batch | null> {
    const batches = (await getBatchesAction()).data;
    if (!batches) return null;
    return batches.find(b => b.id === batchId) || null;
}


export async function logAction(batchId: string, action: string) {
  try {
    const batch = await getBatchById(batchId);
    if (!batch) {
      return { success: false, error: 'Batch not found.' };
    }
    batch.logHistory.push({ date: new Date().toISOString(), action });

    const quantityMatch = action.match(/Adjusted quantity by -(\d+)/);
    if (quantityMatch) {
      const change = parseInt(quantityMatch[1], 10);
      batch.quantity -= change;
    }

    await updateBatchAction(batch);
    return { success: true, data: batch };
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
    batch.status = 'Archived';
    const action = `Archived with loss of ${loss} units. Final quantity: ${batch.quantity}.`;
    batch.logHistory.push({ date: new Date().toISOString(), action });

    await updateBatchAction(batch);
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
    const sourceBatch = await getBatchById(sourceBatchId);
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

    const newBatch: Omit<Batch, 'id'> = {
      ...newBatchData,
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

    // Add new batch to the database
    const newBatchResult = await addBatchAction(newBatch);
    if (!newBatchResult.success || !newBatchResult.data) {
        throw new Error('Failed to create new batch during transplant.');
    }
    
    // Update the source batch
    await updateBatchAction(sourceBatch);

    return { success: true, data: { sourceBatch, newBatch: newBatchResult.data } };
  } catch (error) {
    console.error('Error transplanting batch:', error);
    return { success: false, error: 'Failed to transplant batch.' };
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
