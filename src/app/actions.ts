
'use server';

import { careRecommendations } from '@/ai/flows/care-recommendations';
import { productionProtocol } from '@/ai/flows/production-protocol';
import { batchChat } from '@/ai/flows/batch-chat-flow';
import type { Batch } from '@/lib/types';
import { promises as fs } from 'fs';
import { join } from 'path';
import admin from 'firebase-admin';

// Correct Firebase Admin SDK Initialization
function initializeFirebaseAdmin() {
    if (!admin.apps.length) {
        try {
            const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
            if (serviceAccountKey) {
            const serviceAccount = JSON.parse(serviceAccountKey);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            } else {
            console.warn('FIREBASE_SERVICE_ACCOUNT_KEY is not set. Firebase dependant features may not work.');
            }
        } catch (error) {
            console.error('Failed to initialize Firebase Admin SDK in actions.ts:', error);
        }
    }
}


async function migrateData() {
    initializeFirebaseAdmin();
    const db = admin.firestore();
    console.log("Checking if data migration is needed...");
    const batchesRef = db.collection('batches');
    const snapshot = await batchesRef.limit(1).get();

    if (snapshot.empty) {
        console.log("No batches found in Firestore. Migrating from data.json...");
        const dataFilePath = join(process.cwd(), 'src', 'lib', 'data.json');
        try {
            const fileContent = await fs.readFile(dataFilePath, 'utf-8');
            const batches: Batch[] = JSON.parse(fileContent);
            
            const firestoreBatch = db.batch();
            batches.forEach(batch => {
                const docRef = batchesRef.doc(batch.id);
                firestoreBatch.set(docRef, batch);
            });
            
            await firestoreBatch.commit();
            console.log(`Successfully migrated ${batches.length} batches to Firestore.`);

            // Rename the file to prevent re-migration
            await fs.rename(dataFilePath, dataFilePath + '.migrated');
            console.log("Renamed data.json to data.json.migrated");

        } catch (error: any) {
            if (error.code === 'ENOENT') {
                 console.log("data.json not found, assuming already migrated.");
            } else {
                console.error('Error during data migration:', error);
                throw new Error('Could not read or process data.json for migration.');
            }
        }
    } else {
        console.log("Firestore already contains data. Skipping migration.");
    }
}


export async function getCareRecommendationsAction(batch: Batch) {
  initializeFirebaseAdmin();
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
  initializeFirebaseAdmin();
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
  initializeFirebaseAdmin();
  const db = admin.firestore();
  try {
    await migrateData();
    const batchesCollection = db.collection('batches');
    const snapshot = await batchesCollection.orderBy('batchNumber').get();
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
  initializeFirebaseAdmin();
  const db = admin.firestore();
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
  initializeFirebaseAdmin();
  const db = admin.firestore();
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
    initializeFirebaseAdmin();
    const db = admin.firestore();
    const docRef = db.collection('batches').doc(batchId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
        return docSnap.data() as Batch;
    }
    return null;
}


export async function logAction(batchId: string, action: string, quantityChange: number | null = null, newLocation: string | null = null) {
  initializeFirebaseAdmin();
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
  initializeFirebaseAdmin();
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
  initializeFirebaseAdmin();
  const db = admin.firestore();
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

export async function batchChatAction(batch: Batch, query: string) {
    initializeFirebaseAdmin();
    try {
      const result = await batchChat({ batch, query });
      return { success: true, data: result };
    } catch (error) {
      console.error('Error in batch chat action:', error);
      return { success: false, error: 'Failed to get AI chat response.' };
    }
}
