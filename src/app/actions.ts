
'use server';

import { careRecommendations } from '@/ai/flows/care-recommendations';
import { productionProtocol } from '@/ai/flows/production-protocol';
import { batchChat } from '@/ai/flows/batch-chat-flow';
import type { Batch } from '@/lib/types';
import { promises as fs } from 'fs';
import { join } from 'path';

import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';


// Helper to initialize Firebase Admin SDK
function getAdminFirestore() {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
    }
    const serviceAccount = JSON.parse(serviceAccountKey);

    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    return getFirestore();
}


const dataFilePath = join(process.cwd(), 'src', 'lib', 'data.json');

async function seedData() {
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    const batchesFromFile = JSON.parse(fileContent) as Batch[];

    const db = getAdminFirestore();
    const batch = db.batch();
    batchesFromFile.forEach((batchData) => {
        const docRef = db.collection('batches').doc(batchData.id);
        const data = { ...batchData };
        delete (data as any).id;
        batch.set(docRef, data);
    });
    await batch.commit();
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
    const db = getAdminFirestore();
    const batchesCollection = db.collection('batches');
    const snapshot = await batchesCollection.get();

    if (snapshot.empty) {
        await seedData();
        const seededSnapshot = await batchesCollection.get();
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
  newBatchData: Omit<Batch, 'id' | 'logHistory'>
) {
  try {
    const db = getAdminFirestore();
    const newBatch: Omit<Batch, 'id'> = {
      ...newBatchData,
      logHistory: [{ date: new Date().toISOString(), action: 'Batch created.' }],
    }
    
    const docRef = await db.collection("batches").add(newBatch);
    
    const batchWithId: Batch = {
        ...newBatch,
        id: docRef.id,
    }
    
    return { success: true, data: batchWithId };
  } catch (error) {
    console.error('Error adding batch:', error);
    return { success: false, error: 'Failed to add batch.' };
  }
}

export async function updateBatchAction(batchToUpdate: Batch) {
  try {
    const db = getAdminFirestore();
    const batchRef = db.collection("batches").doc(batchToUpdate.id);
    const dataToUpdate = { ...batchToUpdate };
    delete (dataToUpdate as any).id; // Never write the ID as a field in the document
    await batchRef.update(dataToUpdate);
    return { success: true, data: batchToUpdate };
  } catch (error) {
    console.error('Error updating batch:', error);
    return { success: false, error: 'Failed to update batch.' };
  }
}

async function getBatchById(batchId: string): Promise<Batch | null> {
    try {
        const db = getAdminFirestore();
        const batchRef = db.collection("batches").doc(batchId);
        const docSnap = await batchRef.get();
        if (docSnap.exists) {
            return { id: docSnap.id, ...docSnap.data() } as Batch;
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (error) {
        console.error("Error getting batch by ID:", error);
        return null;
    }
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

const getNextBatchNumber = async () => {
    const db = getAdminFirestore();
    const batchesSnapshot = await db.collection('batches').get();
    const maxBatchNum = batchesSnapshot.docs.reduce((max, doc) => {
        const batch = doc.data() as Batch;
        const numPart = parseInt(batch.batchNumber.split('-')[1] || '0', 10);
        return numPart > max ? numPart : max;
    }, 0); // Start with 0 in case there are no batches
    return (maxBatchNum + 1).toString().padStart(6, '0');
};


export async function transplantBatchAction(
  sourceBatchId: string,
  newBatchData: Omit<Batch, 'id' | 'logHistory' | 'transplantedFrom' | 'batchNumber'>,
  transplantQuantity: number,
  logRemainingAsLoss: boolean
) {
  try {
    const db = getAdminFirestore();
    const sourceBatchDocRef = db.collection('batches').doc(sourceBatchId);
    
    // Use a transaction to ensure atomicity
    const { sourceBatch, newBatch } = await db.runTransaction(async (transaction) => {
      const sourceBatchSnap = await transaction.get(sourceBatchDocRef);
      if (!sourceBatchSnap.exists) {
        throw new Error('Source batch not found.');
      }
      
      const sourceBatch = { id: sourceBatchSnap.id, ...sourceBatchSnap.data() } as Batch;

      if (sourceBatch.quantity < transplantQuantity) {
        throw new Error('Insufficient quantity in source batch.');
      }

      // Prepare the updates for the source batch
      const sourceBatchUpdate: any = {
        quantity: sourceBatch.quantity - transplantQuantity,
        logHistory: [
          ...sourceBatch.logHistory,
          {
            date: new Date().toISOString(),
            action: `Transplanted ${transplantQuantity} units to new batch.`,
          },
        ],
      };

      if (logRemainingAsLoss) {
        const remaining = sourceBatch.quantity - transplantQuantity;
        if (remaining > 0) {
            sourceBatchUpdate.logHistory.push({
                date: new Date().toISOString(),
                action: `Archived with loss of ${remaining} units.`
            });
        }
        sourceBatchUpdate.status = 'Archived';
        sourceBatchUpdate.quantity = 0;
      }

      // Prepare the new batch document
      const newBatchRef = db.collection('batches').doc();
      
      const batchNumberPrefix = {
          'Propagation': '1',
          'Plugs/Liners': '2',
          'Potted': '3',
          'Ready for Sale': '4',
          'Looking Good': '6',
          'Archived': '5'
      };
      const allBatchesSnapshot = await db.collection('batches').get();
      const maxBatchNum = allBatchesSnapshot.docs.reduce((max, doc) => {
          const batch = doc.data() as Batch;
          const numPart = parseInt(batch.batchNumber.split('-')[1] || '0', 10);
          return numPart > max ? numPart : max;
      }, 0);
      const nextBatchNumStr = (maxBatchNum + 1).toString().padStart(6, '0');
      const prefixedBatchNumber = `${batchNumberPrefix[newBatchData.status]}-${nextBatchNumStr}`;

      const newBatch: Batch = {
        ...(newBatchData as any),
        id: newBatchRef.id,
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
      
      const newBatchForFirestore = { ...newBatch };
      delete (newBatchForFirestore as any).id;

      transaction.update(sourceBatchDocRef, sourceBatchUpdate);
      transaction.set(newBatchRef, newBatchForFirestore);

      return {
        sourceBatch: { ...sourceBatch, ...sourceBatchUpdate },
        newBatch,
      };
    });
    
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
