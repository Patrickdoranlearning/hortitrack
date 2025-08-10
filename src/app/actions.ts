
'use server';

import { careRecommendations } from '@/ai/flows/care-recommendations';
import { productionProtocol } from '@/ai/flows/production-protocol';
import { batchChat } from '@/ai/flows/batch-chat-flow';
import type { Batch } from '@/lib/types';
import { promises as fs } from 'fs';
import { join } from 'path';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  writeBatch as firestoreWriteBatch, 
  getDoc,
  query,
  where
} from 'firebase/firestore';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
} from 'firebase/auth';
import { z } from 'zod';


const dataFilePath = join(process.cwd(), 'src', 'lib', 'data.json');

async function seedData() {
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    const batchesFromFile = JSON.parse(fileContent) as Batch[];

    const firestoreBatch = firestoreWriteBatch(db);
    batchesFromFile.forEach((batch) => {
        // Use the existing ID from the file for the document ID in Firestore
        const docRef = doc(db, 'batches', batch.id);
        const batchData = { ...batch };
        delete (batchData as any).id; // Don't save the ID as a field
        firestoreBatch.set(docRef, batchData);
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
    
    const docRef = await addDoc(collection(db, "batches"), { ...batchWithHistory });
    
    const batchWithId: Batch = {
        ...batchWithHistory,
        id: docRef.id,
    }
    
    return { success: true, data: batchWithId };
  } catch (error) {
    console.error('Error adding batch:', error);
    return { success: false, error: 'Failed to add batch.' };
  }
}

export async function updateBatchAction(updatedBatch: Batch) {
  try {
    const batchRef = doc(db, "batches", updatedBatch.id);
    const dataToUpdate = { ...updatedBatch };
    delete (dataToUpdate as any).id; // Never write the ID as a field in the document
    await setDoc(batchRef, dataToUpdate, { merge: true });
    return { success: true, data: updatedBatch };
  } catch (error) {
    console.error('Error updating batch:', error);
    return { success: false, error: 'Failed to update batch.' };
  }
}

async function getBatchById(batchId: string): Promise<Batch | null> {
    try {
        const batchRef = doc(db, "batches", batchId);
        const docSnap = await getDoc(batchRef);
        if (docSnap.exists()) {
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

export async function transplantBatchAction(
  sourceBatchId: string,
  newBatchData: Omit<Batch, 'id' | 'logHistory' | 'transplantedFrom'>,
  transplantQuantity: number
) {
  try {
    const sourceBatchDocRef = doc(db, 'batches', sourceBatchId);
    const sourceBatchSnap = await getDoc(sourceBatchDocRef);

    if (!sourceBatchSnap.exists()) {
      return { success: false, error: 'Source batch not found.' };
    }

    const sourceBatch = { id: sourceBatchSnap.id, ...sourceBatchSnap.data() } as Batch;

    if (sourceBatch.quantity < transplantQuantity) {
      return { success: false, error: 'Insufficient quantity in source batch.' };
    }

    // Prepare the updates for the source batch
    const sourceBatchUpdate = {
      quantity: sourceBatch.quantity - transplantQuantity,
      logHistory: [
        ...sourceBatch.logHistory,
        {
          date: new Date().toISOString(),
          action: `Transplanted ${transplantQuantity} units to new batch.`,
        },
      ],
    };

    // Prepare the new batch document
    const newBatchRef = doc(collection(db, 'batches'));
    const { id, ...newBatchDataWithoutId } = newBatchData; // Exclude id from data
    const newBatch: Batch = {
      ...newBatchDataWithoutId,
      id: newBatchRef.id,
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
    
    const newBatchForFirestore = { ...newBatch };
    delete (newBatchForFirestore as any).id;


    // Use a write batch to perform atomic operation
    const batch = firestoreWriteBatch(db);
    batch.update(sourceBatchDocRef, sourceBatchUpdate);
    batch.set(newBatchRef, newBatchForFirestore);
    
    await batch.commit();

    // Return both updated source and new batch for UI updates
    const updatedSourceBatch: Batch = { ...sourceBatch, ...sourceBatchUpdate };

    return { success: true, data: { sourceBatch: updatedSourceBatch, newBatch } };
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

// AUTHENTICATION ACTIONS

const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});


export async function signupAction(values: z.infer<typeof signupSchema>) {
    try {
        const { email, password } = signupSchema.parse(values);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { success: true, data: { uid: userCredential.user.uid } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export async function loginAction(values: z.infer<typeof loginSchema>) {
    try {
        const { email, password } = loginSchema.parse(values);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, data: { uid: userCredential.user.uid } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

    