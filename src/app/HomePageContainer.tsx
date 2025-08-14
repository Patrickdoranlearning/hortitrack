'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection } from '@/hooks/use-collection';
import {
  Batch,
  NurseryLocation,
  PlantSize,
  Supplier,
  Variety,
} from '@/lib/types';
import { INITIAL_PLANT_SIZES } from '@/lib/constants';
import { INITIAL_SUPPLIERS } from '@/lib/suppliers';
import {
  addBatchAction,
  updateBatchAction,
  archiveBatchAction,
  transplantBatchAction,
  logAction,
  addVarietyAction,
} from '@/app/actions';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import HomePageView from './HomePageView';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

function dedupeByName<T extends { id?: string; name?: string; size?: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const key = (item.name ?? item.size ?? "").trim().toLowerCase();
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

  const { data: batches, isLoading: isDataLoading } = useCollection<Batch>('batches');
  const { data: varieties } = useCollection<Variety>('varieties', [], [["name", "!=", ""]]);
  const { data: nurseryLocations } = useCollection<NurseryLocation>('locations');
  const { data: plantSizes } = useCollection<PlantSize>(
    'sizes',
    INITIAL_PLANT_SIZES
  );
  const { data: suppliers } = useCollection<Supplier>(
    'suppliers',
    INITIAL_SUPPLIERS
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    plantFamily: 'all',
    category: 'all',
    status: 'Active',
  });

  const plantFamilies = useMemo(
    () => ['all', ...Array.from(new Set(batches.map((b) => b.plantFamily).filter(Boolean)))],
    [batches]
  );
  const categories = useMemo(
    () => ['all', ...Array.from(new Set(batches.map((b) => b.category).filter(Boolean)))],
    [batches]
  );

  const filteredBatches = useMemo(() => {
    return batches
      .filter((batch) =>
        `${batch.plantFamily} ${batch.plantVariety} ${batch.category} ${
          batch.supplier || ''
        }`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
      .filter(
        (batch) =>
          filters.plantFamily === 'all' ||
          batch.plantFamily === filters.plantFamily
      )
      .filter(
        (batch) =>
          filters.category === 'all' || batch.category === filters.category
      )
      .filter((batch) => {
        if (filters.status === 'all') return true;
        if (filters.status === 'Active') return batch.status !== 'Archived';
        return batch.status === filters.status;
      });
  }, [batches, searchQuery, filters]);

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
      isDataLoading={isDataLoading}
      authLoading={authLoading}
      user={user}
      batches={filteredBatches}
      plantFamilies={plantFamilies}
      categories={categories}
      filters={filters}
      setFilters={setFilters}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
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
