
'use server';

import { productionProtocol } from '@/ai/flows/production-protocol';
import { careRecommendations, type CareRecommendationsInput, type CareRecommendationsOutput } from '@/ai/flows/care-recommendations';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import type { Batch, NurseryLocation, PlantSize, Supplier, Variety } from '@/lib/types';
import { db } from '@/lib/firebase-admin';
import { z } from 'zod';
import { generateNextBatchId, type BatchPhase } from '@/server/batches/nextId';
import { declassify } from '@/server/utils/declassify';

async function getBatchById(batchId: string): Promise<Batch | null> {
    const docRef = db.collection('batches').doc(batchId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
        return declassify({ ...docSnap.data(), id: docSnap.id }) as Batch;
    }
    return null;
}

export async function getBatchesAction() {
    try {
        const snapshot = await db.collection('batches').get();
        const batches = snapshot.docs.map(doc => declassify({ ...doc.data(), id: doc.id })) as Batch[];
        return { success: true, data: batches };
    } catch (error: any) {
        console.error('Error getting batches:', error);
        return { success: false, error: 'Failed to fetch batches: ' + error.message };
    }
}

export async function getProductionProtocolAction(batchId: string) {
  try {
    const batch = await getBatchById(batchId);
    if (!batch) {
        return { success: false, error: 'Batch not found.' };
    }
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

export async function getCareRecommendationsAction(batchId: string) {
  try {
    const batch = await getBatchById(batchId);
    if (!batch) {
        return { success: false, error: 'Batch not found.' };
    }
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

export async function batchChatAction(batchId: string, query: string) {
  try {
    const batch = await getBatchById(batchId);
    if (!batch) {
        return { success: false, error: 'Batch not found.' };
    }
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
        return { success: false, error: `Failed to add variety: ${error.message || 'An unknown error occurred'}` };
    }
}


export async function addBatchAction(
  newBatchData: Omit<Batch, 'id' | 'logHistory' | 'batchNumber'>
) {
  try {
    const stageMap: Record<string, BatchPhase> = {
      'Propagation': 'PROPAGATION',
      'Plugs/Liners': 'PLUGS',
      'Potted': 'POTTING',
      'Ready for Sale': 'POTTING',
      'Looking Good': 'POTTING'
    };
    const phase = stageMap[newBatchData.status] || 'POTTING';
    
    // Use the new batch ID generator
    const { id: batchNumber } = await generateNextBatchId(phase, new Date(newBatchData.plantingDate));
    
    const newDocRef = db.collection('batches').doc();
    const newBatch: Batch = {
      ...(newBatchData as any),
      id: newDocRef.id,
      batchNumber: batchNumber,
      logHistory: [{ id: `log_${Date.now()}`, date: new Date().toISOString(), type: 'CREATE', note: `Batch created with number ${batchNumber}.` }],
    };
    
    await newDocRef.set(newBatch);
    return { success: true, data: declassify(newBatch) };

  } catch (error: any) {
    console.error('Error adding batch:', error);
    return { success: false, error: 'Failed to add batch: ' + error.message };
  }
}

export async function updateBatchAction(batchToUpdate: Batch) {
  try {
    const incoming = { ...batchToUpdate };
    if (!incoming.id) throw new Error("Missing batch id");

    const ref = db.collection('batches').doc(incoming.id);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: 'Batch not found.' };

    const stored = declassify({ ...snap.data(), id: snap.id }) as Batch;

    // Enforce invariants on the server (do NOT trust client)
    const nextQty = incoming.quantity ?? stored.quantity;
    const initialQty = stored.initialQuantity; // immutable baseline
    if (nextQty > initialQty) {
      return { success: false, error: 'Quantity cannot exceed initial quantity.' };
    }

    // Auto-archive when quantity hits zero; force zero while archived
    const nextStatus = incoming.status ?? stored.status;
    const shouldArchive = nextQty <= 0 || nextStatus === 'Archived';

    const updated: Batch = {
      ...stored,
      ...incoming,
      quantity: shouldArchive ? 0 : nextQty,
      status: shouldArchive ? 'Archived' : nextStatus,
      updatedAt: new Date().toISOString(),
      logHistory: [
        ...(stored.logHistory || []),
        ...((shouldArchive && stored.status !== 'Archived')
          ? [{
              id: `log_${Date.now()}`,
              date: new Date().toISOString(),
              type: 'ARCHIVE',
              note: 'Batch quantity reached zero and was automatically archived.'
            }]
          : []),
      ],
    };

    await ref.set(updated, { merge: true });
    return { success: true, data: declassify(updated) };
  } catch (error: any) {
    console.error('Error updating batch:', error);
    return { success: false, error: 'Failed to update batch: ' + error.message };
  }
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
      return { success: true, data: declassify(result.data) };
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
        return { success: true, data: declassify(result.data) };
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
  newBatchData: Omit<Batch, 'id' | 'logHistory' | 'transplantedFrom' | 'batchNumber' | 'quantity' | 'initialQuantity'>,
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

        const stageMap: Record<string, BatchPhase> = {
            'Propagation': 'PROPAGATION',
            'Plugs/Liners': 'PLUGS',
            'Potted': 'POTTING',
            'Ready for Sale': 'POTTING',
            'Looking Good': 'POTTING'
        };
        const phase = stageMap[newBatchData.status] || 'POTTING';
        const { id: batchNumber } = await generateNextBatchId(phase, new Date(newBatchData.plantingDate));

        const newDocRef = db.collection('batches').doc();
        const newBatch: Batch = {
            ...(newBatchData as any),
            id: newDocRef.id,
            batchNumber: batchNumber,
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
        
        return { success: true };
    });

  } catch (error: any) {
    console.error('Error transplanting batch:', error);
    return { success: false, error: error.message || 'Failed to transplant batch.' };
  }
}

export async function addLocationAction(locationData: Omit<NurseryLocation, 'id'>) {
    try {
        const docRef = db.collection('locations').doc();
        const newLocation = { ...locationData, id: docRef.id };
        await docRef.set(newLocation);
        return { success: true, data: newLocation };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateLocationAction(locationData: NurseryLocation) {
    try {
        const docRef = db.collection('locations').doc(locationData.id!);
        await docRef.set(locationData, { merge: true });
        return { success: true, data: locationData };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteLocationAction(locationId: string) {
    try {
        await db.collection('locations').doc(locationId).delete();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function addSizeAction(sizeData: Omit<PlantSize, 'id'>) {
    try {
        const docRef = db.collection('sizes').doc();
        const newSize = { ...sizeData, id: docRef.id };
        await docRef.set(newSize);
        return { success: true, data: newSize };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSizeAction(sizeData: PlantSize) {
    try {
        const docRef = db.collection('sizes').doc(sizeData.id!);
        await docRef.set(sizeData, { merge: true });
        return { success: true, data: sizeData };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteSizeAction(sizeId: string) {
    try {
        await db.collection('sizes').doc(sizeId).delete();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function addSupplierAction(supplierData: Omit<Supplier, 'id'>) {
    try {
        const docRef = db.collection('suppliers').doc();
        const newSupplier = { ...supplierData, id: docRef.id };
        await docRef.set(newSupplier);
        return { success: true, data: newSupplier };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSupplierAction(supplierData: Supplier) {
    try {
        const docRef = db.collection('suppliers').doc(supplierData.id!);
        await docRef.set(supplierData, { merge: true });
        return { success: true, data: supplierData };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteSupplierAction(supplierId: string) {
    try {
        await db.collection('suppliers').doc(supplierId).delete();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


export async function updateVarietyAction(varietyData: Variety) {
    try {
        const docRef = db.collection('varieties').doc(varietyData.id!);
        await docRef.set(varietyData, { merge: true });
        return { success: true, data: varietyData };
    } catch (error: any) {
        return { success: false, error: `Failed to update variety: ${error.message || 'An unknown error occurred'}` };
    }
}

export async function deleteVarietyAction(varietyId: string) {
    try {
        await db.collection('varieties').doc(varietyId).delete();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function addBatchesFromCsvAction(batches: any[]) {
    try {
        const writeBatch = db.batch();
        
        for (const batchData of batches) {
            const docRef = db.collection('batches').doc();
            
            const stageMap: Record<string, BatchPhase> = {
              'Propagation': 'PROPAGATION',
              'Plugs/Liners': 'PLUGS',
              'Potted': 'POTTING',
              'Ready for Sale': 'POTTING',
              'Looking Good': 'POTTING'
            };
            const phase = stageMap[batchData.status] || 'POTTING';
            // Note: This runs the transaction for each row, which is inefficient but safe.
            // A more performant approach would pre-allocate numbers, but this is simpler.
            const { id: batchNumber } = await generateNextNextBatchId(phase, new Date(batchData.plantingDate));

            const newBatch: Omit<Batch, 'id'> = {
              ...batchData,
              batchNumber,
              logHistory: [{ id: `log_${Date.now()}`, date: new Date().toISOString(), type: 'CREATE', note: `Batch created from CSV import with number ${batchNumber}.` }],
            };
            writeBatch.set(docRef, newBatch);
        }

        await writeBatch.commit();
        return { success: true, message: `${batches.length} batches imported successfully.` };
    } catch (error: any) {
        console.error("Error importing batches from CSV:", error);
        return { success: false, error: error.message };
    }
}
