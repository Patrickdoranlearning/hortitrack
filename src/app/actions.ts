
'use server';

import { productionProtocol } from '@/ai/flows/production-protocol';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import {
  careRecommendations,
  type CareRecommendationsInput,
} from '@/ai/flows/care-recommendations';
import type {
  Batch,
  LogEntry,
  Variety,
  NurseryLocation,
  PlantSize,
  Supplier,
} from '@/lib/types';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

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
    const batches = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    })) as Batch[];
    return { success: true, data: batches };
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
) {
  try {
    const result = await db.runTransaction(async (tx) => {
      const next = await getNextBatchNumberInTx(tx);
      const batchNumber = numberWithPrefix(newBatchData.status, next);

      const docRef = db.collection('batches').doc();
      const batchToWrite: Omit<Batch, 'id'> = {
        ...newBatchData,
        batchNumber,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        logHistory: [
          {
            id: `log_${Date.now()}`,
            date: Timestamp.now(), // ✅ concrete timestamp allowed inside arrays
            type: 'CREATE',
            note: 'Batch created.',
            qty: newBatchData.quantity,
          },
        ],
      };

      tx.set(docRef, batchToWrite);

      return { id: docRef.id, batchNumber };
    });

    return { success: true, data: result };
  } catch (e: any) {
    console.error('Error adding batch:', e);
    return { success: false, error: e?.message ?? 'Failed to add batch.' };
  }
}

export async function addBatchesFromCsvAction(
  newBatchesData: Omit<
    Batch,
    'id' | 'logHistory' | 'batchNumber' | 'createdAt' | 'updatedAt'
  >[]
) {
  const counterRef = db.collection('counters').doc('batches');

  try {
    await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let currentBatchNum = 0;
      if (counterDoc.exists && counterDoc.data()!.count) {
        currentBatchNum = counterDoc.data()!.count;
      } else {
        transaction.set(counterRef, { count: 0 });
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
        currentBatchNum++;
        const nextBatchNumStr = currentBatchNum.toString().padStart(6, '0');
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
      transaction.update(counterRef, { count: currentBatchNum });
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
    const updatedBatchData = { ...batchToUpdate };

    // Ensure quantity doesn't go below zero
    updatedBatchData.quantity = Math.max(0, updatedBatchData.quantity);

    let wasArchived = false;
    if (
      updatedBatchData.quantity <= 0 &&
      updatedBatchData.status !== 'Archived'
    ) {
      updatedBatchData.logHistory.push({
        id: `log_${Date.now()}`,
        date: Timestamp.now(),
        type: 'ARCHIVE',
        note: `Batch quantity reached zero and was automatically archived.`,
      });
      updatedBatchData.status = 'Archived';
      wasArchived = true;
    }

    if (updatedBatchData.status === 'Archived' && !wasArchived) {
      updatedBatchData.quantity = 0;
    }

    const batchesCollection = db.collection('batches');
    const batchDoc = batchesCollection.doc(updatedBatchData.id);
    await batchDoc.update({
      ...updatedBatchData,
      updatedAt: FieldValue.serverTimestamp(),
    });
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

export async function logAction(
  batchId: string,
  logData: Partial<LogEntry> & { type: LogEntry['type'] }
) {
  try {
    const batch = await getBatchById(batchId);
    if (!batch) {
      return { success: false, error: 'Batch not found.' };
    }

    const updatedBatch = { ...batch };

    const newLog: Partial<LogEntry> & { type: LogEntry['type'] } = {
      id: `log_${Date.now()}`,
      date: Timestamp.now(),
      type: logData.type,
    };

    switch (logData.type) {
      case 'NOTE':
        newLog.note = logData.note;
        break;
      case 'MOVE':
        newLog.note = `Moved batch from ${batch.location} to ${logData.newLocation}`;
        newLog.newLocation = logData.newLocation;
        updatedBatch.location = logData.newLocation!;
        break;
      case 'LOSS':
        newLog.note = `Logged loss of ${logData.qty}. Reason: ${logData.reason}`;
        newLog.qty = logData.qty;
        newLog.reason = logData.reason;
        updatedBatch.quantity -= logData.qty!;
        break;
      case 'Batch Spaced':
        newLog.note = 'Batch Spaced';
        break;
      case 'Batch Trimmed':
        newLog.note = 'Batch Trimmed';
        break;
      default:
        return { success: false, error: 'Invalid log action type.' };
    }

    updatedBatch.logHistory.push(newLog as LogEntry);

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
    return { success: false, error: 'Failed to archive batch: ' + error.message };
  }
}

// ---------- TRANSPLANT ----------
export async function transplantBatchAction(
  sourceBatchId: string,
  newBatchData: Omit<
    Batch,
    'id' | 'logHistory' | 'transplantedFrom' | 'batchNumber' | 'createdAt' | 'updatedAt'
  >,
  transplantQuantity: number,
  logRemainingAsLoss: boolean
) {
  try {
    const result = await db.runTransaction(async (tx) => {
      // Load source
      const sourceRef = db.collection("batches").doc(sourceBatchId);
      const sourceSnap = await tx.get(sourceRef);
      if (!sourceSnap.exists) throw new Error("Source batch not found.");

      const source = { id: sourceSnap.id, ...(sourceSnap.data() as any) } as Batch;
      if (transplantQuantity <= 0) throw new Error("Transplant quantity must be > 0.");
      if (transplantQuantity > source.quantity)
        throw new Error("Transplant quantity exceeds available quantity.");

      // Next number for the new batch
      const next = await getNextBatchNumberInTx(tx);
      const newBatchNumber = numberWithPrefix(newBatchData.status, next);

      // Create the new batch
      const newRef = db.collection("batches").doc();
      const now = Timestamp.now();

      const newBatch: Omit<Batch, "id"> = {
        ...newBatchData,
        batchNumber: newBatchNumber,
        initialQuantity: transplantQuantity,
        quantity: transplantQuantity,
        transplantedFrom: source.batchNumber,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        logHistory: [
          {
            id: `log_${Date.now()}_from`,
            date: now, // ✅ not a sentinel inside array
            type: "TRANSPLANT_FROM",
            note: `Created from transplant of ${transplantQuantity} units from batch ${source.batchNumber}.`,
            qty: transplantQuantity,
            fromBatch: source.batchNumber,
          },
        ],
      };

      tx.set(newRef, newBatch);

      // Update source batch quantity and logs
      const remaining = source.quantity - transplantQuantity;

      const sourceLogUpdates: any[] = [
        {
          id: `log_${Date.now()}_to`,
          date: now,
          type: "TRANSPLANT_TO",
          note: `Transplanted ${transplantQuantity} units to new batch ${newBatchNumber}.`,
          qty: -transplantQuantity,
          reason: 'Transplant',
          toBatch: newBatchNumber,
        },
      ];

      if (logRemainingAsLoss) {
          const remainingQty = source.quantity - transplantQuantity;
          if (remainingQty > 0) {
              sourceLogUpdates.push({
                  id: `log_${Date.now()}_loss`,
                  date: Timestamp.now(),
                  type: 'ARCHIVE',
                  note: `Archived with loss of ${remainingQty} units.`,
                  qty: -remainingQty,
                  reason: 'Archived remaining'
              });
          }
          source.status = 'Archived';
          source.quantity = 0;
      } else {
          source.quantity -= transplantQuantity;
      }

      // Merge with existing history safely
      const updatedHistory = Array.isArray(source.logHistory)
        ? [...source.logHistory, ...sourceLogUpdates]
        : sourceLogUpdates;
      
      const sourceUpdateData: any = {
        quantity: source.quantity,
        logHistory: updatedHistory,
        updatedAt: FieldValue.serverTimestamp(),
      }

      if(logRemainingAsLoss) {
        sourceUpdateData.status = 'Archived';
      }
      
      if (source.quantity <= 0 && source.status !== 'Archived') {
            sourceUpdateData.status = 'Archived';
            sourceUpdateData.logHistory.push({ 
                id: `log_${Date.now()}_auto_archive`,
                date: Timestamp.now(), 
                type: 'ARCHIVE', 
                note: `Batch quantity reached zero and was automatically archived.` 
            });
        }
        
      tx.update(sourceRef, sourceUpdateData);

      return {
        newBatch: { id: newRef.id, batchNumber: newBatchNumber },
        sourceBatch: { id: source.id, batchNumber: source.batchNumber, remaining: source.quantity },
      };
    });

    return { success: true, data: result };
  } catch (e: any) {
    console.error("Error transplanting batch:", e);
    return { success: false, error: e?.message ?? "Failed to transplant batch." };
  }
}


// Actions for Varieties
export async function addVarietyAction(varietyData: Omit<Variety, 'id'>) {
  try {
    const docRef = await db.collection('varieties').add(varietyData);
    return { success: true, data: { ...varietyData, id: docRef.id } };
  } catch (error: any) {
    console.error('Error adding variety:', error);
    return { success: false, error: 'Failed to add variety: ' + error.message };
  }
}

export async function updateVarietyAction(varietyData: Variety) {
  try {
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
export async function addLocationAction(locationData: Omit<NurseryLocation, 'id'>) {
  try {
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
    const docRef = await db.collection('sizes').add(sizeData);
    return { success: true, data: { ...sizeData, id: docRef.id } };
  } catch (error: any) {
    console.error('Error adding size:', error);
    return { success: false, error: 'Failed to add size: ' + error.message };
  }
}

export async function updateSizeAction(sizeData: PlantSize) {
  try {
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
    const { id, ...dataToUpdate } = supplierData;
    await db.collection('suppliers').doc(id).update(dataToUpdate);
    return { success: true, data: supplierData };
  } catch (error: any)
{
    console.error('Error updating supplier:', error);
    return {
      success: false,
      error: 'Failed to update supplier: ' + error.message,
    };
  }
}

export async function deleteSupplierAction(supplierId: string) {
  try {
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

    