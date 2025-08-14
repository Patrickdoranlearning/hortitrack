
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
  TransplantFormData,
  LogEntry,
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
import { BatchDistribution } from '@/components/batch-form';


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
  const { data: varieties, isLoading: varietiesLoading } = useCollection<Variety>('varieties', [], [["name", "!=", ""]]);
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

  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchDistribution, setBatchDistribution] = useState<BatchDistribution | null>(null);
  const [transplantingBatch, setTransplantingBatch] = useState<Batch | null>(
    null
  );
  const [actionLogBatch, setActionLogBatch] = useState<Batch | null>(null);

  // State for dialogs, managed here
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTransplantFormOpen, setIsTransplantFormOpen] = useState(false);
  const [isActionLogFormOpen, setIsActionLogFormOpen] = useState(false);
  const [isVarietyFormOpen, setIsVarietyFormOpen] = useState(false);
  const [newVarietyName, setNewVarietyName] = useState('');


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

  const handleNewBatch = () => {
    setEditingBatch(null);
    setBatchDistribution(null);
    setIsFormOpen(true);
  };

  const handleEditBatch = (batch: Batch) => {
    const transplantedQuantity = (batch.logHistory || [])
      .filter(
        (log) => log.type === 'TRANSPLANT_TO' && typeof log.qty === 'number'
      )
      .reduce((sum, log) => sum - (log.qty || 0), 0);
    const lostQuantity = (batch.logHistory || [])
      .filter((log) => log.type === 'LOSS' && typeof log.qty === 'number')
      .reduce((sum, log) => sum + (log.qty || 0), 0);

    setBatchDistribution({
      inStock: batch.quantity,
      transplanted: transplantedQuantity,
      lost: lostQuantity,
    });
    setEditingBatch(batch);
    setIsFormOpen(true);
  };

  const handleArchiveBatch = async (batchId: string) => {
    const batchToArchive = batches.find((b) => b.id === batchId);
    if (!batchToArchive) return;

    const loss = batchToArchive.quantity;
    const result = await archiveBatchAction(batchId, loss);

    if (result.success) {
      toast({
        title: 'Success',
        description: `Batch #${batchToArchive.batchNumber} has been archived.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error archiving batch',
        description: result.error,
      });
    }
  };

  const handleFormSubmit = async (
    data: Omit<
      Batch,
      'id' | 'batchNumber' | 'createdAt' | 'updatedAt'
    > & { id?: string; batchNumber?: string }
  ) => {
    if (editingBatch) {
      const result = await updateBatchAction(data as Batch);
      if (result.success) {
        toast({
          title: 'Batch Updated',
          description: `Batch #${result.data?.batchNumber} saved.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: result.error,
        });
      }
    } else {
      const newBatchData = {
        ...data,
        supplier: data.supplier || 'Doran Nurseries',
        initialQuantity: data.quantity,
      };

      const result = await addBatchAction(newBatchData);
      if (result.success) {
        toast({
          title: 'Batch Created',
          description: `Batch #${result.data?.batchNumber} added.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Create Failed',
          description: String(result.error ?? 'Unknown error'),
        });
      }
    }
    setEditingBatch(null);
    setBatchDistribution(null);
    setIsFormOpen(false);
  };

  const handleTransplantBatch = (batch: Batch) => {
    setTransplantingBatch(batch);
    setIsTransplantFormOpen(true);
  };

  const onTransplantFormSubmit = async (values: any) => {
    if (!transplantingBatch) return;
    const transplantQuantity = Number(values?.transplantQuantity ?? values?.quantity ?? 0);
    if (!transplantQuantity || transplantQuantity <= 0) {
        toast({ variant: "destructive", title: "Transplant quantity required", description: "Enter a quantity greater than zero." });
        return;
    }
  
      const newBatchData: Omit<
        Batch,
        "id" | "logHistory" | "transplantedFrom" | "batchNumber" | "createdAt" | "updatedAt"
      > = {
        plantVariety: transplantingBatch.plantVariety,
        plantFamily: transplantingBatch.plantFamily,
        category: transplantingBatch.category,
        size: values.size || transplantingBatch.size,
        location: values.location || transplantingBatch.location,
        supplier: values.supplier || transplantingBatch.supplier,
        status: (values.status as Batch["status"]) || transplantingBatch.status,
        plantingDate: transplantingBatch.plantingDate,
        growerPhotoUrl: transplantingBatch.growerPhotoUrl ?? "",
        salesPhotoUrl: transplantingBatch.salesPhotoUrl ?? "",
        initialQuantity: transplantQuantity,
        quantity: transplantQuantity,
      };
  
      const logRemainingAsLoss = Boolean(values?.logRemainingAsLoss);
  
      const result = await transplantBatchAction(
        transplantingBatch.id,
        newBatchData,
        transplantQuantity,
        logRemainingAsLoss
      );
      
      if (result.success) {
        toast({
          title: 'Transplant Successful',
          description: `New batch #${result.data.newBatch.batchNumber} created.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Transplant Failed',
          description: result.error,
        });
      }
      setTransplantingBatch(null);
      setIsTransplantFormOpen(false);
  };

  const handleLogAction = (batch: Batch) => {
    setActionLogBatch(batch);
    setIsActionLogFormOpen(true);
  };

  const onActionLogFormSubmit = async (values: any) => {
    if (!actionLogBatch) return;

    const payload = {
        type: values.type,
        note: values.note ?? "",
        qty: values.qty ? Number(values.qty) : undefined,
        reason: values.reason,
        newLocation: values.newLocation, // legacy name support
        newLocationId: values.newLocationId, // future (if your UI adds it)
      };
  
      const result = await logAction(actionLogBatch.id, payload as any);
      
      if (result.success) {
        toast({
          title: 'Action Logged',
          description: 'The action has been successfully logged.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Logging Failed',
          description: result.error,
        });
      }
      setActionLogBatch(null);
      setIsActionLogFormOpen(false);
  };

  const handleCreateNewVariety = (name: string) => {
    setNewVarietyName(name);
    setIsVarietyFormOpen(true);
  };

  const handleVarietyFormSubmit = async (varietyData: Omit<Variety, 'id'>) => {
    const result = await addVarietyAction(varietyData);

    if (result.success && result.data?.id) {
        toast({ title: 'Variety Added', description: `Successfully added "${result.data.name}".` });
        // The useCollection hook will update the varieties list automatically
        setIsVarietyFormOpen(false);
        setNewVarietyName('');
    } else {
        toast({ variant: 'destructive', title: 'Add Failed', description: result.error });
    }
  }
  
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
      isDataLoading={isDataLoading || varietiesLoading}
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
      onNewBatch={handleNewBatch}
      onEditBatch={handleEditBatch}
      onArchiveBatch={handleArchiveBatch}
      onTransplantBatch={handleTransplantBatch}
      onLogAction={handleLogAction}
      onFormSubmit={handleFormSubmit}
      onTransplantFormSubmit={onTransplantFormSubmit}
      onActionLogFormSubmit={onActionLogFormSubmit}
      editingBatch={editingBatch}
      setEditingBatch={setEditingBatch}
      batchDistribution={batchDistribution}
      transplantingBatch={transplantingBatch}
      setTransplantingBatch={setTransplantingBatch}
      actionLogBatch={actionLogBatch}
      setActionLogBatch={setActionLogBatch}
      nurseryLocations={uniqueNurseryLocations}
      plantSizes={uniquePlantSizes}
      suppliers={uniqueSuppliers}
      varieties={varieties}
      isFormOpen={isFormOpen}
      setIsFormOpen={setIsFormOpen}
      isTransplantFormOpen={isTransplantFormOpen}
      setIsTransplantFormOpen={setIsTransplantFormOpen}
      isActionLogFormOpen={isActionLogFormOpen}
      setIsActionLogFormOpen={setIsActionLogFormOpen}
      isVarietyFormOpen={isVarietyFormOpen}
      setIsVarietyFormOpen={setIsVarietyFormOpen}
      newVarietyName={newVarietyName}
      onCreateNewVariety={handleCreateNewVariety}
      onVarietyFormSubmit={handleVarietyFormSubmit}
    />
  );
}
