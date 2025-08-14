
'use server';

import { db, FieldValue, Timestamp } from '@/lib/firebase-admin';
import type { Batch, LogEntry } from '@/lib/types';
import {
  productionProtocol,
  ProductionProtocolOutput,
} from '@/ai/flows/production-protocol';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import {
  careRecommendations,
  type CareRecommendationsInput,
} from '@/ai/flows/care-recommendations';
import type {
  Variety,
  NurseryLocation,
  PlantSize,
  Supplier,
} from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';

// Ensure every action returns only primitives/arrays/objects with primitives
type ActionOk<T> = { success: true; data: T };
type ActionErr = { success: false; error: string };
export type ActionResult<T> = ActionOk<T> | ActionErr;

function ok<T>(data: T): ActionOk<T> {
  return { success: true, data };
}
function err(message: unknown): ActionErr {
  return { success: false, error: String(message ?? 'Unknown error') };
}

// Helper function to safely stringify any object, converting Timestamps
function safeJsonStringify(obj: any): string {
    const replacer = (_: string, value: any) => {
        // Admin Timestamp (object shape)
        if (value && typeof value === 'object' && value._seconds != null && value._nanoseconds != null) {
          return new Timestamp(value._seconds, value._nanoseconds).toDate().toISOString();
        }
        // Admin/Client Timestamp instance
        if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
        // Plain Date
        if (value instanceof Date) return value.toISOString();
        return value;
    };
    return JSON.stringify(obj, replacer);
}

// Helper to deserialize and convert dates back if needed, or just parse
function deepJsonParse(jsonString: string): any {
    return JSON.parse(jsonString, (key, value) => {
        if (typeof value === 'string') {
            const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
            if (isoDateRegex.test(value)) {
                return new Date(value);
            }
        }
        return value;
    });
}


async function requireAuth() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) throw new Error('Unauthorized');
  const auth = getAuth();
  await auth.verifySessionCookie(sessionCookie, true);
}

// Helper to upsert and return next counter value atomically
async function getNextBatchNumberInTx(
  tx: FirebaseFirestore.Transaction
): Promise<number> {
  const counterRef = db.collection('counters').doc('batches');
  const snap = await tx.get(counterRef);

  let next = 1;
  if (!snap.exists) {
    // First ever batch number
    tx.set(counterRef, { count: 1 });
    next = 1;
  } else {
    const current = Number(snap.data()?.count ?? 0);
    next = current + 1;
    tx.update(counterRef, { count: next });
  }
  return next;
}

function numberWithPrefix(status: Batch['status'], n: number): string {
  const prefix: Record<Batch['status'], string> = {
    Propagation: '1',
    'Plugs/Liners': '2',
    Potted: '3',
    'Ready for Sale': '4',
    'Looking Good': '6',
    Archived: '5',
  };
  const seq = String(n).padStart(6, '0');
  return `${prefix[status]}-${seq}`;
}

export async function getBatchesAction() {
  try {
    const snapshot = await db.collection('batches').get();
    const batchesData = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));
    
    // Serialize the data to ensure it's plain objects
    const serializedData = safeJsonStringify(batchesData);
    const plainBatches = deepJsonParse(serializedData);

    return { success: true, data: plainBatches as Batch[] };
  } catch (error: any) {
    console.error('Error getting batches:', error);
    return {
      success: false,
      error: 'Failed to fetch batches: ' + error.message,
    };
  }
}

export async function getProductionProtocolAction(batch: Batch) {
  try {
    await requireAuth(); // Auth required for AI actions
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
    await requireAuth(); // Auth required for AI actions
    const input: CareRecommendationsInput = {
      batchInfo: {
        plantFamily: batch.plantFamily,
        plantVariety: batch.plantVariety,
        plantingDate: batch.plantingDate,
      },
      logHistory: batch.logHistory.map((log) => log.note || log.type),
    };
    const result = await careRecommendations(input);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error in care recommendations action:', error);
    return { success: false, error: 'Failed to get AI care recommendations.' };
  }
}

export async function batchChatAction(batch: Batch, query: string) {
  try {
    await requireAuth(); // Auth required for AI actions
    const input: BatchChatInput = { batch, query };
    const result = await batchChat(input);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error in batch chat action:', error);
    return { success: false, error: 'Failed to get AI response.' };
  }
}

// ---------- CREATE ----------
export async function addBatchAction(
  newBatchData: Omit<
    Batch,
    'id' | 'logHistory' | 'batchNumber' | 'createdAt' | 'updatedAt'
  >
): Promise<ActionResult<{ id: string; batchNumber: string }>> {
  try {
    await requireAuth(); // Auth required
    const { id, batchNumber } = await db.runTransaction(async (tx) => {
      const next = await getNextBatchNumberInTx(tx);
      const batchNumber = numberWithPrefix(newBatchData.status, next);
      const ref = db.collection('batches').doc();

      tx.set(ref, {
        ...newBatchData,
        id: ref.id,
        batchNumber,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        logHistory: [
          {
            id: `log_${Date.now()}`,
            date: Timestamp.now(), // concrete timestamp (OK inside arrays)
            type: 'CREATE',
            note: 'Batch created.',
            qty: newBatchData.quantity,
          },
        ],
      });

      return { id: ref.id, batchNumber };
    });

    // ✅ Return only primitives
    return ok({ id, batchNumber });
  } catch (e: any) {
    console.error('addBatchAction failed:', e);
    return err(e?.message ?? e);
  }
}

export async function addBatchesFromCsvAction(
  newBatchesData: Omit<
    Batch,
    'id' | 'logHistory' | 'batchNumber' | 'createdAt' | 'updatedAt'
  >[]
) {
  try {
    await requireAuth(); // Auth required
    const counterRef = db.collection('counters').doc('batches');

    await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let current = 0;
      if (!counterDoc.exists) {
        transaction.set(counterRef, { count: 0 });
      } else {
        current = Number(counterDoc.data()?.count ?? 0);
      }

      const batchNumberPrefixMap: Record<Batch['status'], string> = {
        Propagation: '1',
        'Plugs/Liners': '2',
        Potted: '3',
        'Ready for Sale': '4',
        'Looking Good': '6',
        Archived: '5',
      };

      for (const batchData of newBatchesData) {
        current++;
        const nextBatchNumStr = current.toString().padStart(6, '0');
        const prefixedBatchNumber = `${
          batchNumberPrefixMap[batchData.status]
        }-${nextBatchNumStr}`;

        const newDocRef = db.collection('batches').doc();
        const newBatch: Omit<Batch, 'id'> = {
          ...batchData,
          batchNumber: prefixedBatchNumber,
          logHistory: [
            {
              id: `log_${Date.now()}`,
              date: Timestamp.now(),
              type: 'CREATE',
              note: 'Batch created via CSV import.',
              qty: batchData.quantity,
            },
          ],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        transaction.set(newDocRef, newBatch);
      }
      transaction.update(counterRef, { count: current });
    });
    return {
      success: true,
      message: `${newBatchesData.length} batches added successfully.`,
    };
  } catch (error: any) {
    console.error('Error adding batches from CSV:', error);
    return { success: false, error: 'Failed to add batches: ' + error.message };
  }
}

export async function updateBatchAction(
  batchToUpdate: Omit<Batch, 'createdAt' | 'updatedAt'> & {
    updatedAt?: any;
    createdAt?: any;
  }
) {
  try {
    await requireAuth(); // Auth required
    const batch = await getBatchById(batchToUpdate.id!);
    if (!batch) {
      return err('Batch not found.');
    }

    const updatedBatchData = { ...batchToUpdate };
    const prevStatus = batch.status;

    // Ensure quantity doesn't go below zero
    updatedBatchData.quantity = Math.max(0, updatedBatchData.quantity);

    if (
      updatedBatchData.quantity <= 0 &&
      prevStatus !== 'Archived'
    ) {
      updatedBatchData.logHistory.push({
        id: `log_${Date.now()}`,
        date: Timestamp.now(),
        type: 'ARCHIVE',
        note: `Auto-archived when quantity reached 0.`,
      });
      updatedBatchData.status = 'Archived';
    }
    
    if (updatedBatchData.status === 'Archived' && prevStatus !== 'Archived') {
      updatedBatchData.quantity = 0;
    }


    const batchesCollection = db.collection('batches');
    const batchDoc = batchesCollection.doc(updatedBatchData.id!);
    await batchDoc.update({
      ...updatedBatchData,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true, data: updatedBatchData };
  } catch (error: any) {
    console.error('Error updating batch:', error);
    return {
      success: false,
      error: 'Failed to update batch: ' + error.message,
    };
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

export async function logAction(
  batchId: string,
  logData: Partial<LogEntry> & { type: LogEntry['type'] }
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAuth(); // Auth required
    const batch = await getBatchById(batchId);
    if (!batch) {
      return err('Batch not found.');
    }

    const now = Timestamp.now();
    const newLog: LogEntry = {
      id: `log_${Date.now()}`,
      date: now,
      type: logData.type,
      note: logData.note ?? '',
      qty: logData.qty,
      reason: logData.reason,
      newLocation: logData.newLocation,
    };

    const updates: any = {
      logHistory: FieldValue.arrayUnion(newLog),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (logData.type === 'MOVE' && logData.newLocation) {
      updates.location = logData.newLocation;
    } else if (logData.type === 'LOSS' && typeof logData.qty === 'number') {
      updates.quantity = FieldValue.increment(-logData.qty);
    }

    await db.collection('batches').doc(batchId).update(updates);

    return ok({ id: batchId });
  } catch (e: any) {
    console.error('logAction failed:', e);
    return err(e?.message ?? e);
  }
}

export async function archiveBatchAction(batchId: string, loss: number) {
  try {
    await requireAuth(); // Auth required
    const batch = await getBatchById(batchId);
    if (!batch) {
      return { success: false, error: 'Batch not found.' };
    }

    const updatedBatch = { ...batch };

    updatedBatch.status = 'Archived';

    const newLog: LogEntry = {
      id: `log_${Date.now()}`,
      date: Timestamp.now(),
      type: 'ARCHIVE',
      note: `Archived with loss of ${loss} units. Final quantity: ${
        batch.quantity - loss
      }.`,
      qty: loss,
      reason: 'Archived',
    };
    updatedBatch.logHistory.push(newLog);
    updatedBatch.quantity = 0;

    const result = await updateBatchAction(updatedBatch);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('Error archiving batch:', error);
    return {
      success: false,
      error: 'Failed to archive batch: ' + error.message,
    };
  }
}

// ---------- TRANSPLANT ----------
export async function transplantBatchAction(
  sourceBatchId: string,
  newBatchData: Omit<
    Batch,
    'id' | 'logHistory' | 'transplantedFrom' | 'batchNumber' | 'createdAt' | 'updatedAt' | 'initialQuantity'
  >,
  transplantQuantity: number,
  logRemainingAsLoss: boolean
): Promise<
  ActionResult<{
    newBatch: { id: string; batchNumber: string };
    sourceBatch: { id: string; batchNumber: string; remaining: number };
  }>
> {
  try {
    await requireAuth(); // Auth required
    const result = await db.runTransaction(async (tx) => {
      const sourceRef = db.collection('batches').doc(sourceBatchId);
      const sourceSnap = await tx.get(sourceRef);
      if (!sourceSnap.exists) throw new Error('Source batch not found.');

      const source = {
        id: sourceSnap.id,
        ...(sourceSnap.data() as any),
      } as Batch;

      if (transplantQuantity <= 0)
        throw new Error('Transplant quantity must be > 0.');
      if (transplantQuantity > source.quantity)
        throw new Error('Transplant quantity exceeds available quantity.');

      const next = await getNextBatchNumberInTx(tx);
      const newBatchNumber = numberWithPrefix(newBatchData.status, next);

      const now = Timestamp.now();
      const newRef = db.collection('batches').doc();

      tx.set(newRef, {
        ...newBatchData,
        id: newRef.id,
        batchNumber: newBatchNumber,
        initialQuantity: transplantQuantity,
        quantity: transplantQuantity,
        transplantedFrom: source.batchNumber,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        logHistory: [
          {
            id: `log_${Date.now()}_from`,
            date: now, // ✅ concrete timestamp
            type: 'TRANSPLANT_FROM',
            note: `Created from transplant of ${transplantQuantity} units from batch ${source.batchNumber}.`,
            qty: transplantQuantity,
            fromBatch: source.batchNumber,
          },
        ],
      });

      const remaining = source.quantity - transplantQuantity;

      const sourceLog = [
        {
          id: `log_${Date.now()}_to`,
          date: now,
          type: 'TRANSPLANT_TO',
          note: `Transplanted ${transplantQuantity} units to new batch ${newBatchNumber}.`,
          qty: -transplantQuantity,
          reason: 'Transplant',
          toBatch: newBatchNumber,
        },
        ...(logRemainingAsLoss && remaining > 0
          ? [
              {
                id: `log_${Date.now()}_loss`,
                date: now,
                type: 'LOSS',
                qty: remaining,
                reason: 'Remaining after transplant',
                note: `Logged ${remaining} units as loss after transplant.`,
              },
            ]
          : []),
      ];

      const updatedHistory = Array.isArray(source.logHistory)
        ? [...source.logHistory, ...sourceLog]
        : sourceLog;

      const sourceUpdateData: any = {
        logHistory: updatedHistory,
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      const prevStatus = source.status;
      sourceUpdateData.quantity = Math.max(0, source.quantity - transplantQuantity);
      if (logRemainingAsLoss) {
        sourceUpdateData.quantity = 0;
      }
      if (sourceUpdateData.quantity <= 0 && prevStatus !== 'Archived') {
          sourceUpdateData.status = 'Archived';
          sourceUpdateData.logHistory.push({ id: `log_${Date.now()}`, date: Timestamp.now(), type: 'ARCHIVE', note: 'Auto-archived when quantity reached 0.' });
      }

      tx.update(sourceRef, sourceUpdateData);

      return {
        newBatch: { id: newRef.id, batchNumber: newBatchNumber },
        sourceBatch: {
          id: source.id,
          batchNumber: source.batchNumber,
          remaining: sourceUpdateData.quantity,
        },
      };
    });

    // ✅ Only primitives/strings/numbers
    return ok(result);
  } catch (e: any) {
    console.error('transplantBatchAction failed:', e);
    return err(e?.message ?? e);
  }
}

// Actions for Varieties
export async function addVarietyAction(varietyData: Omit<Variety, 'id'>) {
  try {
    await requireAuth(); // Auth required
    const docRef = await db.collection('varieties').add(varietyData);
    return { success: true, data: { ...varietyData, id: docRef.id } };
  } catch (error: any) {
    console.error('Error adding variety:', error);
    return { success: false, error: 'Failed to add variety: ' + error.message };
  }
}

export async function updateVarietyAction(varietyData: Variety) {
  try {
    await requireAuth(); // Auth required
    const { id, ...dataToUpdate } = varietyData;
    await db.collection('varieties').doc(id!).update(dataToUpdate);
    return { success: true, data: varietyData };
  } catch (error: any) {
    console.error('Error updating variety:', error);
    return {
      success: false,
      error: 'Failed to update variety: ' + error.message,
    };
  }
}

export async function deleteVarietyAction(varietyId: string) {
  try {
    await requireAuth(); // Auth required
    await db.collection('varieties').doc(varietyId).delete();
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting variety:', error);
    return {
      success: false,
      error: 'Failed to delete variety: ' + error.message,
    };
  }
}

// Actions for Locations
export async function addLocationAction(
  locationData: Omit<NurseryLocation, 'id'>
) {
  try {
    await requireAuth(); // Auth required
    const docRef = await db.collection('locations').add(locationData);
    return { success: true, data: { ...locationData, id: docRef.id } };
  } catch (error: any) {
    console.error('Error adding location:', error);
    return {
      success: false,
      error: 'Failed to add location: ' + error.message,
    };
  }
}

export async function updateLocationAction(locationData: NurseryLocation) {
  try {
    await requireAuth(); // Auth required
    const { id, ...dataToUpdate } = locationData;
    await db.collection('locations').doc(id).update(dataToUpdate);
    return { success: true, data: locationData };
  } catch (error: any) {
    console.error('Error updating location:', error);
    return {
      success: false,
      error: 'Failed to update location: ' + error.message,
    };
  }
}

export async function deleteLocationAction(locationId: string) {
  try {
    await requireAuth(); // Auth required
    await db.collection('locations').doc(locationId).delete();
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting location:', error);
    return {
      success: false,
      error: 'Failed to delete location: ' + error.message,
    };
  }
}

// Actions for Plant Sizes
export async function addSizeAction(sizeData: Omit<PlantSize, 'id'>) {
  try {
    await requireAuth(); // Auth required
    const docRef = await db.collection('sizes').add(sizeData);
    return { success: true, data: { ...sizeData, id: docRef.id } };
  } catch (error: any) {
    console.error('Error adding size:', error);
    return { success: false, error: 'Failed to add size: ' + error.message };
  }
}

export async function updateSizeAction(sizeData: PlantSize) {
  try {
    await requireAuth(); // Auth required
    const { id, ...dataToUpdate } = sizeData;
    await db.collection('sizes').doc(id).update(dataToUpdate);
    return { success: true, data: sizeData };
  } catch (error: any) {
    console.error('Error updating size:', error);
    return { success: false, error: 'Failed to update size: ' + error.message };
  }
}

export async function deleteSizeAction(sizeId: string) {
  try {
    await requireAuth(); // Auth required
    await db.collection('sizes').doc(sizeId).delete();
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting size:', error);
    return { success: false, error: 'Failed to delete size: ' + error.message };
  }
}

// Actions for Suppliers
export async function addSupplierAction(supplierData: Omit<Supplier, 'id'>) {
  try {
    await requireAuth(); // Auth required
    const docRef = await db.collection('suppliers').add(supplierData);
    return { success: true, data: { ...supplierData, id: docRef.id } };
  } catch (error: any) {
    console.error('Error adding supplier:', error);
    return {
      success: false,
      error: 'Failed to add supplier: ' + error.message,
    };
  }
}

export async function updateSupplierAction(supplierData: Supplier) {
  try {
    await requireAuth(); // Auth required
    const { id, ...dataToUpdate } = supplierData;
    await db.collection('suppliers').doc(id).update(dataToUpdate);
    return { success: true, data: supplierData };
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    return {
      success: false,
      error: 'Failed to update supplier: ' + error.message,
    };
  }
}

export async function deleteSupplierAction(supplierId: string) {
  try {
    await requireAuth(); // Auth required
    await db.collection('suppliers').doc(supplierId).delete();
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    return {
      success: false,
      error: 'Failed to delete supplier: ' + error.message,
    };
  }
}
