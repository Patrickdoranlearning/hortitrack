'use client';

import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection } from 'rxdb';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import type { RxJsonSchema } from 'rxdb';

addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

export type OfflineBatchDoc = {
  id: string;
  orgId: string | null;
  batchNumber: string | null;
  batchNumberIndex: string;
  variety: string | null;
  family: string | null;
  size: string | null;
  location: string | null;
  status: string | null;
  quantity: number;
  updatedAt: string | null;
};

type OfflineCollections = {
  batches: RxCollection<OfflineBatchDoc>;
};

const batchSchema: RxJsonSchema<OfflineBatchDoc> = {
  title: 'offline-batches',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'batchNumberIndex', 'quantity'],
  properties: {
    id: { type: 'string', maxLength: 50 },
    orgId: { type: 'string', nullable: true },
    batchNumber: { type: ['string', 'null'] },
    batchNumberIndex: { type: 'string' },
    variety: { type: ['string', 'null'] },
    family: { type: ['string', 'null'] },
    size: { type: ['string', 'null'] },
    location: { type: ['string', 'null'] },
    status: { type: ['string', 'null'] },
    quantity: { type: 'number', minimum: 0 },
    updatedAt: { type: ['string', 'null'] },
  },
  indexes: ['batchNumberIndex'],
};

let dbPromise: Promise<RxDatabase<OfflineCollections>> | null = null;

async function initDb() {
  if (typeof window === 'undefined') {
    throw new Error('Offline DB is only available in the browser.');
  }

  if (!dbPromise) {
    dbPromise = createRxDatabase<OfflineCollections>({
      name: 'hortitrack-offline',
      storage: getRxStorageDexie(),
      eventReduce: true,
      multiInstance: false,
    }).then(async (db) => {
      await db.addCollections({
        batches: {
          schema: batchSchema,
        },
      });
      return db;
    });
  }

  return dbPromise;
}

export async function getOfflineDb() {
  return initDb();
}

export async function replaceOfflineBatches(docs: OfflineBatchDoc[]) {
  const db = await getOfflineDb();
  const existing = await db.batches.find().exec();
  if (existing.length) {
    await Promise.all(existing.map((doc) => doc.remove()));
  }
  if (docs.length) {
    await db.batches.bulkInsert(docs);
  }
}

