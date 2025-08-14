
import {
  addBatchAction,
  addVarietyAction,
  archiveBatchAction,
  logAction,
  transplantBatchAction,
  updateBatchAction,
} from '@/app/actions';
import HomePageView from '@/app/page';
import { auth } from '@/lib/firebase';
import { INITIAL_PLANT_SIZES } from '@/lib/constants';
import { INITIAL_SUPPLIERS } from '@/lib/suppliers';
import {
  Batch,
  NurseryLocation,
  PlantSize,
  Supplier,
  Variety,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useCollection } from '@/hooks/use-collection';
import { useToast } from '@/hooks/use-toast';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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

export default function HomePageContainer() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const { data: batches, isLoading: isDataLoading } =
    useCollection<Batch>('batches');
  const { data: varieties } = useCollection<Variety>('varieties', [], [
    ['name', '!=', ''],
  ]);
  const { data: nurseryLocations } =
    useCollection<NurseryLocation>('locations');
  const { data: plantSizes } = useCollection<PlantSize>(
    'sizes',
    INITIAL_PLANT_SIZES
  );
  const { data: suppliers } = useCollection<Supplier>(
    'suppliers',
    INITIAL_SUPPLIERS
  );

  const plantFamilies = useMemo(
    () => [
      'all',
      ...Array.from(new Set(batches.map((b) => b.plantFamily).filter(Boolean))),
    ],
    [batches]
  );
  const categories = useMemo(
    () => [
      'all',
      ...Array.from(new Set(batches.map((b) => b.category).filter(Boolean))),
    ],
    [batches]
  );

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
    toast({
      title: 'Signed Out',
      description: 'You have been successfully signed out.',
    });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const uniqueSuppliers = dedupeByName(suppliers);
  const uniquePlantSizes = dedupeByName(plantSizes);
  const uniqueNurseryLocations = dedupeByName(nurseryLocations);

  return (
    <HomePageView
      authLoading={authLoading || isDataLoading}
      user={user}
      batches={batches}
      plantFamilies={plantFamilies}
      categories={categories}
      onSignOut={handleSignOut}
      nurseryLocations={uniqueNurseryLocations}
      plantSizes={uniquePlantSizes}
      suppliers={uniqueSuppliers}
      varieties={varieties}
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
