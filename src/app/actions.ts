
'use server';

/**
 * NOTES
 * - Requires Firebase Admin already initialized in `@/lib/firebase-admin`.
 * - Server-side auth: we try to read a Bearer token from headers OR a __session cookie,
 *   then verify it using firebase-admin Auth. If none is found, we throw.
 *   If you’re not ready to enforce auth yet, set ENFORCE_AUTH=false in your env.
 * - All actions now return { success: boolean, data?: T, error?: string }.
 */

import { db, FieldValue, Timestamp } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { headers, cookies } from 'next/headers';

import type {
  Batch,
  LogEntry,
  Variety,
  NurseryLocation,
  PlantSize,
  Supplier,
} from '@/lib/types';

import {
  productionProtocol,
  type ProductionProtocolOutput,
} from '@/ai/flows/production-protocol';
import { batchChat, type BatchChatInput } from '@/ai/flows/batch-chat-flow';
import {
  careRecommendations,
  type CareRecommendationsInput,
} from '@/ai/flows/care-recommendations';

/* ---------------------------------- Types --------------------------------- */

type ActionOk<T> = { success: true; data: T };
type ActionErr = { success: false; error: string };
export type ActionResult<T> = ActionOk<T> | ActionErr;

function ok<T>(data: T): ActionOk<T> {
  return { success: true, data };
}
function err(message: unknown): ActionErr {
  return { success: false, error: String(message ?? 'Unknown error') };
}

/* ----------------------------- Server-side auth ---------------------------- */

const ENFORCE_AUTH = process.env.ENFORCE_AUTH !== 'false';

async function requireAuth(): Promise<{ uid: string } | null> {
  try {
    const h = await headers();
    const authHeader = h.get('Authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    const c = await cookies();
    const tokenFromCookie = c.get('__session')?.value;

    const token = tokenFromHeader || tokenFromCookie;
    if (!token) {
      if (ENFORCE_AUTH) throw new Error('Unauthenticated');
      return null;
    }

    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (e) {
    if (ENFORCE_AUTH) throw e;
    return null;
  }
}

/* ------------------------- Helpers: ids / numbering ------------------------ */

function newId(prefix = 'log'): string {
  // ULID would be ideal; this is collision-resistant enough for our use.
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

const BATCH_PREFIX: Record<Batch['status'], string> = {
  Propagation: '1',
  'Plugs/Liners': '2',
  Potted: '3',
  'Ready for Sale': '4',
  'Looking Good': '6',
  Archived: '5',
};

function numberWithPrefix(status: Batch['status'], n: number): string {
  const seq = String(n).padStart(6, '0');
  return `${BATCH_PREFIX[status]}-${seq}`;
}

// Helper to upsert and return next counter value atomically
async function getNextBatchNumberInTx(
  tx: FirebaseFirestore.Transaction
): Promise<number> {
  const counterRef = db.collection('counters').doc('batches');
  const snap = await tx.get(counterRef);

  if (!snap.exists) {
    tx.set(counterRef, { count: 1 });
    return 1;
  }
  const current = Number(snap.data()?.count ?? 0);
  const next = current + 1;
  tx.update(counterRef, { count: next });
  return next;
}

/* ----------------------------- Server validation --------------------------- */
/**
 * Lightweight runtime guards. (Keep strict Zod for client forms; here we
 * validate only what’s needed to protect Firestore and invariants.)
 */

function assertNonEmptyString(v: unknown, field: string) {
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Invalid ${field}`);
  }
}

function sanitizeNewBatchPayload(
  payload: any
): Omit<
  Batch,
  'id' | 'logHistory' | 'batchNumber' | 'createdAt' | 'updatedAt'
> {
  // required:
  assertNonEmptyString(payload.category, 'category');
  assertNonEmptyString(payload.plantFamily, 'plantFamily');
  assertNonEmptyString(payload.plantVariety, 'plantVariety');
  assertNonEmptyString(payload.plantingDate, 'plantingDate');
  assertNonEmptyString(payload.location, 'location');
  assertNonEmptyString(payload.size, 'size');
  assertNonEmptyString(payload.supplier ?? 'Doran Nurseries', 'supplier');
  if (
    payload.status !== 'Propagation' &&
    payload.status !== 'Plugs/Liners' &&
    payload.status !== 'Potted' &&
    payload.status !== 'Ready for Sale' &&
    payload.status !== 'Looking Good' &&
    payload.status !== 'Archived'
  ) {
    throw new Error('Invalid status');
  }
  const quantity = Number(payload.quantity ?? payload.initialQuantity ?? 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be > 0');
  }

  // Optional URLs
  const growerPhotoUrl =
    typeof payload.growerPhotoUrl === 'string' ? payload.growerPhotoUrl : '';
  const salesPhotoUrl =
    typeof payload.salesPhotoUrl === 'string' ? payload.salesPhotoUrl : '';

  return {
    category: String(payload.category),
    plantFamily: String(payload.plantFamily),
    plantVariety: String(payload.plantVariety),
    plantingDate: String(payload.plantingDate),
    initialQuantity: Number(payload.initialQuantity ?? quantity),
    quantity,
    status: payload.status,
    location: String(payload.location),
    size: String(payload.size),
    supplier: String(payload.supplier ?? 'Doran Nurseries'),
    growerPhotoUrl,
    salesPhotoUrl,
  } as any;
}

function sanitizeUpdateBatchPayload(payload: any): Batch {
  assertNonEmptyString(payload.id, 'id');
  // Keep these immutable:
  // - id, batchNumber, createdAt
  const clean: any = { ...payload };
  delete clean.createdAt;
  delete clean.id; // will pass separately to .doc(id)
  delete clean.batchNumber;

  // Enforce invariants
  if (typeof payload.quantity === 'number') {
    clean.quantity = Math.max(0, Number(payload.quantity));
  }
  if (payload.status === 'Archived') {
    clean.quantity = 0;
  }

  // Normalize photo URLs to string
  if (payload.growerPhotoUrl == null) clean.growerPhotoUrl = '';
  if (payload.salesPhotoUrl == null) clean.salesPhotoUrl = '';

  return { ...payload, ...clean } as Batch;
}

/* --------------------------------- Getters -------------------------------- */

export async function getBatchesAction(): Promise<ActionResult<Batch[]>> {
  try {
    await requireAuth();
    const snapshot = await db.collection('batches').get();
    const batches = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    })) as Batch[];
    return ok(batches);
  } catch (e: any) {
    console.error('Error getting batches:', e);
    return err('Failed to fetch batches: ' + e?.message);
  }
}

/* ------------------------------ AI conveniences --------------------------- */

export async function getProductionProtocolAction(
  batch: Batch
): Promise<ActionResult<ProductionProtocolOutput>> {
  try {
    await requireAuth();
    const protocol = await productionProtocol(batch);
    return ok(protocol);
  } catch (e) {
    console.error('Error getting production protocol:', e);
    return err('Failed to generate AI production protocol.');
  }
}

export async function getCareRecommendationsAction(
  batch: Batch
): Promise<ActionResult<any>> {
  try {
    await requireAuth();
    const input: CareRecommendationsInput = {
      batchInfo: {
        plantFamily: batch.plantFamily,
        plantVariety: batch.plantVariety,
        plantingDate: batch.plantingDate,
      },
      logHistory: (batch.logHistory || []).map((log) => log.note || log.type),
    };
    const result = await careRecommendations(input);
    return ok(result);
  } catch (e) {
    console.error('Error in care recommendations action:', e);
    return err('Failed to get AI care recommendations.');
  }
}

export async function batchChatAction(
  batch: Batch,
  query: string
): Promise<ActionResult<any>> {
  try {
    await requireAuth();
    const input: BatchChatInput = { batch, query };
    const result = await batchChat(input);
    return ok(result);
  } catch (e: any) {
    console.error('Error in batch chat action:', e);
    return err('Failed to get AI response.');
  }
}

/* ---------------------------------- Create -------------------------------- */

export async function addBatchAction(
  incoming: Omit<
    Batch,
    'id' | 'logHistory' | 'batchNumber' | 'createdAt' | 'updatedAt'
  >
): Promise<ActionResult<{ id: string; batchNumber: string }>> {
  try {
    await requireAuth();
    const newBatchData = sanitizeNewBatchPayload(incoming);

    const { id, batchNumber } = await db.runTransaction(async (tx) => {
      const next = await getNextBatchNumberInTx(tx);
      const batchNumber = numberWithPrefix(newBatchData.status, next);
      const ref = db.collection('batches').doc();

      const logId = newId();
      tx.set(ref, {
        ...newBatchData,
        id: ref.id,
        batchNumber,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        logHistory: [
          {
            id: logId,
            date: Timestamp.now(),
            type: 'CREATE',
            note: 'Batch created.',
            qty: newBatchData.quantity,
          },
        ],
      });

      return { id: ref.id, batchNumber };
    });

    return ok({ id, batchNumber });
  } catch (e: any) {
    console.error('addBatchAction failed:', e);
    return err(e?.message ?? e);
  }
}

export async function addBatchesFromCsvAction(
  rows: Omit<
    Batch,
    'id' | 'logHistory' | 'batchNumber' | 'createdAt' | 'updatedAt'
  >[]
): Promise<ActionResult<{ count: number }>> {
  try {
    await requireAuth();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('No rows provided.');
    }

    await db.runTransaction(async (tx) => {
      for (const raw of rows) {
        const batchData = sanitizeNewBatchPayload(raw);
        const next = await getNextBatchNumberInTx(tx);
        const newBatchNumber = numberWithPrefix(batchData.status, next);

        const newRef = db.collection('batches').doc();
        tx.set(newRef, {
          ...batchData,
          id: newRef.id,
          batchNumber: newBatchNumber,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          logHistory: [
            {
              id: newId(),
              date: Timestamp.now(),
              type: 'CREATE',
              note: 'Batch created via CSV import.',
              qty: batchData.quantity,
            },
          ],
        });
      }
    });

    return ok({ count: rows.length });
  } catch (e: any) {
    console.error('Error adding batches from CSV:', e);
    return err('Failed to add batches: ' + e?.message);
  }
}

/* --------------------------------- Update --------------------------------- */

export async function updateBatchAction(
  batchToUpdate: Omit<Batch, 'createdAt' | 'updatedAt'> & {
    updatedAt?: any;
    createdAt?: any;
  }
): Promise<ActionResult<Batch>> {
  try {
    await requireAuth();

    const current = await getBatchById(batchToUpdate.id);
    if (!current) return err('Batch not found.');

    // Apply sanitize rules (immutables enforced)
    const updatedBatchData = sanitizeUpdateBatchPayload(batchToUpdate);

    // Archive auto-invariant
    let wasArchived = current.status === 'Archived';
    if (updatedBatchData.quantity <= 0 && updatedBatchData.status !== 'Archived') {
      updatedBatchData.status = 'Archived';
      wasArchived = true;
      updatedBatchData.logHistory = [
        ...(current.logHistory || []),
        {
          id: newId(),
          date: Timestamp.now(),
          type: 'ARCHIVE',
          note: 'Batch quantity reached zero and was automatically archived.',
        } as any,
      ];
      updatedBatchData.quantity = 0;
    }

    const batchDoc = db.collection('batches').doc(current.id);
    const { id, createdAt, batchNumber, ...rest } = updatedBatchData as any;

    await batchDoc.update({
      ...rest,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return ok({ ...(current as any), ...rest, id: current.id, batchNumber: current.batchNumber });
  } catch (e: any) {
    console.error('Error updating batch:', e);
    return err('Failed to update batch: ' + e?.message);
  }
}

async function getBatchById(batchId: string): Promise<Batch | null> {
  const docRef = db.collection('batches').doc(batchId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return null;
  return { ...docSnap.data(), id: docSnap.id } as Batch;
}

/* ---------------------------------- Logs ---------------------------------- */

export async function logAction(
  batchId: string,
  logData: Partial<LogEntry> & { type: LogEntry['type'] } & {
    // Preferred new field: pass a location ID; we’ll still accept name for now.
    newLocationId?: string;
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAuth();

    if (!batchId) return err('Missing batchId');
    if (!logData?.type) return err('Missing log type');

    const logId = logData.id || newId();

    await db.runTransaction(async (tx) => {
      const ref = db.collection('batches').doc(batchId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Batch not found.');
      const batch = { id: snap.id, ...(snap.data() as any) } as Batch;

      const existing = (batch.logHistory || []).some((l) => l.id === logId);
      if (existing) return; // idempotent

      const now = Timestamp.now();
      const newLog: LogEntry = {
        id: logId,
        date: now,
        type: logData.type,
        note: logData.note ?? '',
        qty: logData.qty,
        reason: logData.reason,
        newLocation: logData.newLocation, // legacy: name
      } as any;

      const update: any = {
        logHistory: [...(batch.logHistory || []), newLog],
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (logData.type === 'MOVE') {
        // Prefer ID if provided; fall back to name for compatibility.
        if (logData.newLocationId) {
          update.locationId = logData.newLocationId;
        } else if (logData.newLocation) {
          update.location = logData.newLocation;
        }
      } else if (logData.type === 'LOSS' && typeof logData.qty === 'number') {
        const nextQty = Math.max(0, Number(batch.quantity || 0) - Number(logData.qty));
        update.quantity = nextQty;
        if (nextQty === 0 && batch.status !== 'Archived') {
          update.status = 'Archived';
          update.logHistory = [
            ...update.logHistory,
            {
              id: newId(),
              date: now,
              type: 'ARCHIVE',
              note: 'Batch quantity reached zero and was automatically archived.',
            },
          ];
        }
      }

      tx.update(ref, update);
    });

    return ok({ id: batchId });
  } catch (e: any) {
    console.error('logAction failed:', e);
    return err(e?.message ?? e);
  }
}

/* --------------------------------- Archive -------------------------------- */

export async function archiveBatchAction(
  batchId: string,
  loss: number
): Promise<ActionResult<Batch>> {
  try {
    await requireAuth();

    const result = await db.runTransaction(async (tx) => {
      const ref = db.collection('batches').doc(batchId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Batch not found.');

      const batch = { id: snap.id, ...(snap.data() as any) } as Batch;
      if (batch.status === 'Archived') {
        return batch; // already archived
      }

      const safeLoss = Math.max(0, Math.min(Number(loss || 0), Number(batch.quantity || 0)));
      const finalQty = 0;

      const logs = [...(batch.logHistory || [])];
      if (safeLoss > 0) {
        logs.push({
          id: newId(),
          date: Timestamp.now(),
          type: 'LOSS',
          note: `Loss during archive.`,
          qty: safeLoss,
          reason: 'Archived',
        } as any);
      }
      logs.push({
        id: newId(),
        date: Timestamp.now(),
        type: 'ARCHIVE',
        note: `Archived. Final quantity: ${finalQty}.`,
        qty: safeLoss || undefined,
        reason: 'Archived',
      } as any);

      const update = {
        status: 'Archived' as const,
        quantity: 0,
        logHistory: logs,
        updatedAt: FieldValue.serverTimestamp(),
      };

      tx.update(ref, update);
      return { ...batch, ...update };
    });

    return ok(result);
  } catch (e: any) {
    console.error('Error archiving batch:', e);
    return err('Failed to archive batch: ' + e?.message);
  }
}

/* -------------------------------- Transplant ------------------------------- */

export async function transplantBatchAction(
  sourceBatchId: string,
  newBatchData: Omit<
    Batch,
    'id' | 'logHistory' | 'transplantedFrom' | 'batchNumber' | 'createdAt' | 'updatedAt'
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
    await requireAuth();

    if (!transplantQuantity || transplantQuantity <= 0) {
      throw new Error('Transplant quantity must be > 0.');
    }

    const result = await db.runTransaction(async (tx) => {
      const sourceRef = db.collection('batches').doc(sourceBatchId);
      const sourceSnap = await tx.get(sourceRef);
      if (!sourceSnap.exists) throw new Error('Source batch not found.');

      const source = { id: sourceSnap.id, ...(sourceSnap.data() as any) } as Batch;
      if (transplantQuantity > (source.quantity || 0)) {
        throw new Error('Transplant quantity exceeds available quantity.');
      }

      const cleanedNew = sanitizeNewBatchPayload({
        ...newBatchData,
        quantity: transplantQuantity,
        initialQuantity: transplantQuantity,
      });

      const next = await getNextBatchNumberInTx(tx);
      const newBatchNumber = numberWithPrefix(cleanedNew.status, next);

      const now = Timestamp.now();
      const newRef = db.collection('batches').doc();

      tx.set(newRef, {
        ...cleanedNew,
        id: newRef.id,
        batchNumber: newBatchNumber,
        transplantedFrom: source.batchNumber,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        logHistory: [
          {
            id: newId(),
            date: now,
            type: 'TRANSPLANT_FROM',
            note: `Created from transplant of ${transplantQuantity} units from batch ${source.batchNumber}.`,
            qty: transplantQuantity,
            fromBatch: source.batchNumber,
          },
        ],
      });

      const remaining = Math.max(0, (source.quantity || 0) - transplantQuantity);

      const sourceLogs = [
        ...(source.logHistory || []),
        {
          id: newId(),
          date: now,
          type: 'TRANSPLANT_TO',
          note: `Transplanted ${transplantQuantity} units to new batch ${newBatchNumber}.`,
          qty: -transplantQuantity,
          reason: 'Transplant',
          toBatch: newBatchNumber,
        },
      ];

      if (logRemainingAsLoss && remaining > 0) {
        sourceLogs.push({
          id: newId(),
          date: now,
          type: 'LOSS',
          qty: remaining,
          reason: 'Remaining after transplant',
          note: `Logged ${remaining} units as loss after transplant.`,
        } as any);
      }

      const sourceUpdate: any = {
        quantity: logRemainingAsLoss ? 0 : remaining,
        logHistory: sourceLogs,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (sourceUpdate.quantity <= 0) {
        sourceUpdate.status = 'Archived';
        sourceUpdate.logHistory.push({
          id: newId(),
          date: now,
          type: 'ARCHIVE',
          note: 'Batch quantity reached zero and was automatically archived.',
        });
      }

      tx.update(sourceRef, sourceUpdate);

      return {
        newBatch: { id: newRef.id, batchNumber: newBatchNumber },
        sourceBatch: {
          id: source.id,
          batchNumber: source.batchNumber,
          remaining: sourceUpdate.quantity,
        },
      };
    });

    return ok(result);
  } catch (e: any) {
    console.error('transplantBatchAction failed:', e);
    return err(e?.message ?? e);
  }
}

/* --------------------- Varieties / Locations / Sizes / Suppliers --------------------- */

export async function addVarietyAction(
  varietyData: Omit<Variety, 'id'>
): Promise<ActionResult<{ id: string } & Omit<Variety, 'id'>>> {
  try {
    await requireAuth();
    const docRef = await db.collection('varieties').add(varietyData);
    return ok({ ...varietyData, id: docRef.id });
  } catch (e: any) {
    console.error('Error adding variety:', e);
    return err('Failed to add variety: ' + e?.message);
  }
}

export async function updateVarietyAction(
  varietyData: Variety
): Promise<ActionResult<Variety>> {
  try {
    await requireAuth();
    const { id, ...dataToUpdate } = varietyData;
    await db.collection('varieties').doc(id!).update(dataToUpdate);
    return ok(varietyData);
  } catch (e: any) {
    console.error('Error updating variety:', e);
    return err('Failed to update variety: ' + e?.message);
  }
}

export async function deleteVarietyAction(
  varietyId: string
): Promise<ActionResult<{}>> {
  try {
    await requireAuth();
    await db.collection('varieties').doc(varietyId).delete();
    return ok({});
  } catch (e: any) {
    console.error('Error deleting variety:', e);
    return err('Failed to delete variety: ' + e?.message);
  }
}

export async function addLocationAction(
  locationData: Omit<NurseryLocation, 'id'>
): Promise<ActionResult<{ id: string } & Omit<NurseryLocation, 'id'>>> {
  try {
    await requireAuth();
    const docRef = await db.collection('locations').add(locationData);
    return ok({ ...locationData, id: docRef.id });
  } catch (e: any) {
    console.error('Error adding location:', e);
    return err('Failed to add location: ' + e?.message);
  }
}

export async function updateLocationAction(
  locationData: NurseryLocation
): Promise<ActionResult<NurseryLocation>> {
  try {
    await requireAuth();
    const { id, ...dataToUpdate } = locationData;
    await db.collection('locations').doc(id).update(dataToUpdate);
    return ok(locationData);
  } catch (e: any) {
    console.error('Error updating location:', e);
    return err('Failed to update location: ' + e?.message);
  }
}

export async function deleteLocationAction(
  locationId: string
): Promise<ActionResult<{}>> {
  try {
    await requireAuth();
    await db.collection('locations').doc(locationId).delete();
    return ok({});
  } catch (e: any) {
    console.error('Error deleting location:', e);
    return err('Failed to delete location: ' + e?.message);
  }
}

export async function addSizeAction(
  sizeData: Omit<PlantSize, 'id'>
): Promise<ActionResult<{ id: string } & Omit<PlantSize, 'id'>>> {
  try {
    await requireAuth();
    const docRef = await db.collection('sizes').add(sizeData);
    return ok({ ...sizeData, id: docRef.id });
  } catch (e: any) {
    console.error('Error adding size:', e);
    return err('Failed to add size: ' + e?.message);
  }
}

export async function updateSizeAction(
  sizeData: PlantSize
): Promise<ActionResult<PlantSize>> {
  try {
    await requireAuth();
    const { id, ...dataToUpdate } = sizeData;
    await db.collection('sizes').doc(id).update(dataToUpdate);
    return ok(sizeData);
  } catch (e: any) {
    console.error('Error updating size:', e);
    return err('Failed to update size: ' + e?.message);
  }
}

export async function deleteSizeAction(
  sizeId: string
): Promise<ActionResult<{}>> {
  try {
    await requireAuth();
    await db.collection('sizes').doc(sizeId).delete();
    return ok({});
  } catch (e: any) {
    console.error('Error deleting size:', e);
    return err('Failed to delete size: ' + e?.message);
  }
}

export async function addSupplierAction(
  supplierData: Omit<Supplier, 'id'>
): Promise<ActionResult<{ id: string } & Omit<Supplier, 'id'>>> {
  try {
    await requireAuth();
    const docRef = await db.collection('suppliers').add(supplierData);
    return ok({ ...supplierData, id: docRef.id });
  } catch (e: any) {
    console.error('Error adding supplier:', e);
    return err('Failed to add supplier: ' + e?.message);
  }
}

export async function updateSupplierAction(
  supplierData: Supplier
): Promise<ActionResult<Supplier>> {
  try {
    await requireAuth();
    const { id, ...dataToUpdate } = supplierData;
    await db.collection('suppliers').doc(id).update(dataToUpdate);
    return ok(supplierData);
  } catch (e: any) {
    console.error('Error updating supplier:', e);
    return err('Failed to update supplier: ' + e?.message);
  }
}

export async function deleteSupplierAction(
  supplierId: string
): Promise<ActionResult<{}>> {
  try {
    await requireAuth();
    await db.collection('suppliers').doc(supplierId).delete();
    return ok({});
  } catch (e: any) {
    console.error('Error deleting supplier:', e);
    return err('Failed to delete supplier: ' + e?.message);
  }
}
