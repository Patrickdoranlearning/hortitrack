
'use server';

import HomePageView from '@/app/HomePageView';
import {
  addBatchAction,
  addVarietyAction,
  archiveBatchAction,
  getBatchesAction,
  logAction,
  transplantBatchAction,
  updateBatchAction,
} from '@/app/actions';
import { INITIAL_PLANT_SIZES } from '@/lib/constants';
import { db } from '@/lib/firebase-admin';
import { INITIAL_SUPPLIERS } from '@/lib/suppliers';
import type { NurseryLocation, PlantSize, Supplier, Variety } from '@/lib/types';
import { collection, getDocs, query, where } from 'firebase/firestore';

async function getCollectionData<T>(
  collectionName: string,
  initialData: any[] = [],
  constraints: any[] = []
): Promise<T[]> {
  try {
    const q = query(collection(db, collectionName), ...constraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty && initialData.length > 0) {
      console.log(`Seeding ${collectionName}...`);
      const batch = db.batch();
      initialData.forEach((item) => {
        const { id, ...data } = item;
        const docRef = collection(db, collectionName).doc();
        batch.set(docRef, data);
      });
      await batch.commit();
      // Re-fetch after seeding
      const seededSnapshot = await getDocs(q);
      const docs = seededSnapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id })
      );
       return JSON.parse(JSON.stringify(docs)) as T[];
    }

    const docs = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    return JSON.parse(JSON.stringify(docs)) as T[];

  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return initialData as T[]; // Return initial/empty data on error
  }
}

function dedupeByName<T extends { id?: string; name?: string; size?: string }>(
  arr: T[]
): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const key = (item.name ?? item.size ?? '').trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      return true;
    }
    return false;
  });
}

export default async function HomePage() {
  const batchesResult = await getBatchesAction();
  const batches = batchesResult.success ? batchesResult.data : [];

  const varieties = await getCollectionData<Variety>('varieties', [], [
    where('name', '!=', ''),
  ]);
  const nurseryLocations =
    await getCollectionData<NurseryLocation>('locations');
  const plantSizes = await getCollectionData<PlantSize>(
    'sizes',
    INITIAL_PLANT_SIZES
  );
  const suppliers = await getCollectionData<Supplier>(
    'suppliers',
    INITIAL_SUPPLIERS
  );

  const plantFamilies = [
    'all',
    ...Array.from(new Set(batches.map((b) => b.plantFamily).filter(Boolean))),
  ];
  const categories = [
    'all',
    ...Array.from(new Set(batches.map((b) => b.category).filter(Boolean))),
  ];

  const uniqueSuppliers = dedupeByName(suppliers);
  const uniquePlantSizes = dedupeByName(plantSizes);
  const uniqueNurseryLocations = dedupeByName(nurseryLocations);

  return (
    <HomePageView
      initialBatches={batches}
      initialVarieties={varieties}
      initialNurseryLocations={uniqueNurseryLocations}
      initialPlantSizes={uniquePlantSizes}
      initialSuppliers={uniqueSuppliers}
      plantFamilies={plantFamilies}
      categories={categories}
      actions={{
        addBatch: addBatchAction,
        updateBatch: updateBatchAction,
        archiveBatch: archiveBatchAction,
        transplantBatch: transplantBatchAction,
        logAction: logAction,
        addVariety: addVarietyAction,
      }}
    />
  );
}
