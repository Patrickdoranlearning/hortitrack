
'use client';

import * as React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  Search,
  Filter,
  ScanLine,
  LayoutDashboard,
  Database,
  LogOut,
} from 'lucide-react';
import type { Batch } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BatchCard } from '@/components/batch-card';
import { BatchForm, type BatchDistribution } from '@/components/batch-form';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Logo } from '@/components/logo';
import { TransplantForm } from '@/components/transplant-form';
import { ActionLogForm } from '@/components/action-log-form';
import { INITIAL_NURSERY_LOCATIONS, INITIAL_PLANT_SIZES } from '@/lib/constants';
import Link from 'next/link';
import { ScannerDialog } from '@/components/scanner-dialog';
import { useToast } from '@/hooks/use-toast';
import type { TransplantFormData } from '@/lib/types';
import { ScannedBatchActionsDialog } from '@/components/scanned-batch-actions-dialog';
import { ProductionProtocolDialog } from '@/components/production-protocol-dialog';
import { 
  getBatchesAction, 
  addBatchAction, 
  updateBatchAction, 
  archiveBatchAction, 
  transplantBatchAction,
  logAction
} from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    plantFamily: string;
    status: string;
    category: string;
  }>({ plantFamily: 'all', status: 'Active', category: 'all' });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  const [isTransplantFormOpen, setIsTransplantFormOpen] = useState(false);
  const [transplantingBatch, setTransplantingBatch] = useState<Batch | null>(null);
  
  const [isActionLogFormOpen, setIsActionLogFormOpen] = useState(false);
  const [actionLogBatch, setActionLogBatch] = useState<Batch | null>(null);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { toast } = useToast();
  
  const [scannedBatch, setScannedBatch] = useState<Batch | null>(null);
  const [isScannedActionsOpen, setIsScannedActionsOpen] = useState(false);

  const [nurseryLocations, setNurseryLocations] = useState<string[]>([]);
  const [plantSizes, setPlantSizes] = useState<string[]>([]);

  const [isProtocolDialogOpen, setIsProtocolDialogOpen] = useState(false);
  const [protocolBatch, setProtocolBatch] = useState<Batch | null>(null);
  
  const [batchDistribution, setBatchDistribution] = useState<BatchDistribution | null>(null);
  
  const [isClient, setIsClient] = useState(false);

  const loadBatches = useCallback(async () => {
    setIsDataLoading(true);
    const { success, data, error } = await getBatchesAction();
    if (success && data) {
      setBatches(data);
    } else {
      toast({ variant: 'destructive', title: 'Error loading batches', description: error });
    }
    setIsDataLoading(false);
  }, [toast]);

  useEffect(() => {
    setIsClient(true);
    if (user) {
        loadBatches();
    }
    
    const storedLocationsRaw = localStorage.getItem('nurseryLocations');
    if (storedLocationsRaw) {
      const storedLocations = JSON.parse(storedLocationsRaw);
      if (storedLocations && storedLocations.length > 0) {
        setNurseryLocations(storedLocations);
      } else {
        setNurseryLocations(INITIAL_NURSERY_LOCATIONS);
      }
    } else {
      setNurseryLocations(INITIAL_NURSERY_LOCATIONS);
    }

    const storedSizesRaw = localStorage.getItem('plantSizes');
    if (storedSizesRaw) {
      const storedSizes = JSON.parse(storedSizesRaw);
      if (storedSizes && storedSizes.length > 0) {
        setPlantSizes(storedSizes);
      } else {
        setPlantSizes(INITIAL_PLANT_SIZES);
      }
    } else {
      setPlantSizes(INITIAL_PLANT_SIZES);
    }
  }, [loadBatches, user]);

  const plantFamilies = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.plantFamily)))], [batches]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.category)))], [batches]);
  const statuses = useMemo(() => ['Active', 'all', 'Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived'], []);

  const filteredBatches = useMemo(() => {
    return batches
      .filter((batch) =>
        `${batch.plantFamily} ${batch.plantVariety} ${batch.category} ${batch.supplier || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter(
        (batch) =>
          filters.plantFamily === 'all' || batch.plantFamily === filters.plantFamily
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

  const getNextBatchNumber = () => {
    const maxBatchNum = batches.reduce((max, b) => {
        const numPart = parseInt(b.batchNumber.split('-')[1] || '0', 10);
        return numPart > max ? numPart : max;
    }, -1);
    return (maxBatchNum + 1).toString().padStart(6, '0');
  }

  const handleNewBatch = () => {
    setEditingBatch(null);
    setBatchDistribution(null);
    setIsFormOpen(true);
  };

  const handleEditBatch = (batch: Batch) => {
    const transplantedQuantity = batches.filter(b => b.transplantedFrom === batch.id).reduce((sum, b) => sum + b.initialQuantity, 0);
    const lossLogRegex = /Logged (\d+) units as loss|Adjusted quantity by -(\d+)|Archived with loss of (\d+)/;
    const lostQuantity = batch.logHistory.reduce((sum, log) => {
      const match = log.action.match(lossLogRegex);
      if (match) {
        return sum + (parseInt(match[1], 10) || parseInt(match[2], 10) || parseInt(match[3], 10));
      }
      return sum;
    }, 0);
    
    setBatchDistribution({
      inStock: batch.quantity,
      transplanted: transplantedQuantity,
      lost: lostQuantity,
    });
    setEditingBatch(batch);
    setIsFormOpen(true);
  };

  const handleArchiveBatch = async (batchId: string) => {
    const batchToArchive = batches.find(b => b.id === batchId);
    if (!batchToArchive) return;
    
    const loss = batchToArchive.quantity;
    const result = await archiveBatchAction(batchId, loss);

    if (result.success) {
      toast({ title: "Success", description: `Batch #${batchToArchive.batchNumber} has been archived.` });
      await loadBatches();
    } else {
      toast({ variant: 'destructive', title: 'Error archiving batch', description: result.error });
    }
    
    setIsFormOpen(false);
    setEditingBatch(null);
  }

  const handleFormSubmit = async (data: Omit<Batch, 'id' | 'batchNumber'> & { id?: string; batchNumber?: string }) => {
    if (editingBatch) {
      const result = await updateBatchAction(data as Batch);
      if (result.success) {
        toast({ title: 'Batch Updated', description: `Batch #${result.data?.batchNumber} saved.`});
      } else {
        toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
      }
    } else {
      const batchNumberPrefix = {
        'Propagation': '1',
        'Plugs/Liners': '2',
        'Potted': '3',
        'Ready for Sale': '4',
        'Looking Good': '6',
        'Archived': '5'
      };
      const nextBatchNumStr = getNextBatchNumber();
      const prefixedBatchNumber = `${batchNumberPrefix[data.status]}-${nextBatchNumStr}`;
      
      const newBatchData = { 
        ...data, 
        batchNumber: prefixedBatchNumber, 
        supplier: data.supplier || 'Doran Nurseries',
        initialQuantity: data.quantity, 
      };

      const result = await addBatchAction(newBatchData);
      if (result.success) {
        toast({ title: 'Batch Created', description: `Batch #${result.data?.batchNumber} added.`});
      } else {
        toast({ variant: 'destructive', title: 'Create Failed', description: result.error });
      }
    }
    await loadBatches();
    setIsFormOpen(false);
    setEditingBatch(null);
    setBatchDistribution(null);
  };

  const handleTransplantBatch = (batch: Batch) => {
    setTransplantingBatch(batch);
    setIsTransplantFormOpen(true);
  };

  const handleTransplantFormSubmit = async (data: TransplantFormData) => {
    if (!transplantingBatch) return;

    const result = await transplantBatchAction(
      transplantingBatch.id,
      data,
      data.quantity,
      data.logRemainingAsLoss
    );
    
    if (result.success) {
      toast({ title: 'Transplant Successful', description: `New batch #${result.data?.newBatch.batchNumber} created.` });
      await loadBatches();
    } else {
      toast({ variant: 'destructive', title: 'Transplant Failed', description: result.error });
    }
    
    setIsTransplantFormOpen(false);
    setTransplantingBatch(null);
  };

  const handleLogAction = (batch: Batch) => {
    setActionLogBatch(batch);
    setIsActionLogFormOpen(true);
  };
  
  const handleActionLogFormSubmit = async (data: any) => {
    if (!actionLogBatch) return;

    let logMessage = '';
    let quantityChange: number | null = null;
    let newLocation: string | null = null;

    switch (data.actionType) {
      case 'log':
        logMessage = data.logMessage;
        break;
      case 'move':
        logMessage = `Moved batch from ${actionLogBatch.location} to ${data.newLocation}`;
        newLocation = data.newLocation;
        break;
      case 'adjust':
        logMessage = `Adjusted quantity by -${data.adjustQuantity}. Reason: ${data.adjustReason}`;
        quantityChange = -data.adjustQuantity;
        break;
      case 'Batch Spaced':
      case 'Batch Trimmed':
        logMessage = data.actionType;
        break;
      default:
        toast({ variant: 'destructive', title: 'Invalid Action', description: 'The selected action is not supported.' });
        return;
    }

    const result = await logAction(actionLogBatch.id, logMessage, quantityChange, newLocation);

    if (result.success) {
      toast({ title: 'Action Logged', description: 'The action has been successfully logged.' });
      await loadBatches();
    } else {
      toast({ variant: 'destructive', title: 'Logging Failed', description: result.error });
    }
    
    setIsActionLogFormOpen(false);
    setActionLogBatch(null);
  };

  const handleScanSuccess = (scannedData: string) => {
    const foundBatch = batches.find(b => b.batchNumber === scannedData);
    if (foundBatch) {
      setScannedBatch(foundBatch);
      setIsScannedActionsOpen(true);
    } else {
      toast({
        variant: 'destructive',
        title: 'Batch not found',
        description: `No batch found with code: ${scannedData}`,
      });
    }
    setIsScannerOpen(false);
  };

  const handleGenerateProtocol = (batch: Batch) => {
    setProtocolBatch(batch);
    setIsProtocolDialogOpen(true);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
    toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
  };
  
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
     return (
        <div className="flex min-h-screen w-full flex-col p-6 items-center justify-center">
            <Logo />
            <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-auto flex-col gap-4 border-b bg-background/80 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
                <Link href="/dashboard">
                    <LayoutDashboard />
                    Dashboard
                </Link>
            </Button>
            <Button asChild variant="outline">
                <Link href="/settings">
                    <Database />
                    Manage Data
                </Link>
            </Button>
            <Button onClick={() => setIsScannerOpen(true)} size="lg">
                <ScanLine />
                Scan Code
            </Button>
            <Button onClick={handleNewBatch} size="lg">
                <PlusCircle />
                New Batch
            </Button>
            <Button onClick={handleSignOut} variant="ghost" size="icon">
                <LogOut />
                <span className="sr-only">Sign Out</span>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <h1 className="text-3xl font-headline text-foreground/80">
                Nursery Stock
            </h1>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by category, family, variety, or supplier..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-muted-foreground" />
            <Select
              value={filters.category}
              onValueChange={(value) =>
                setFilters({ ...filters, category: value })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'all' ? 'All Categories' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.plantFamily}
              onValueChange={(value) =>
                setFilters({ ...filters, plantFamily: value })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by family" />
              </SelectTrigger>
              <SelectContent>
                {plantFamilies.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'all' ? 'All Plant Families' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? 'All Statuses' : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">
        {isDataLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
        ) : filteredBatches.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBatches.map((batch) => (
              <div key={batch.id}>
                <BatchCard
                  batch={batch}
                  onEdit={handleEditBatch}
                  onTransplant={handleTransplantBatch}
                  onLogAction={handleLogAction}
                  onGenerateProtocol={handleGenerateProtocol}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/50">
            <p className="text-lg font-medium text-muted-foreground">
              No batches found.
            </p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters, or create a new batch.
            </p>
          </div>
        )}
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl">
          <BatchForm
            batch={editingBatch}
            distribution={batchDistribution}
            onSubmit={handleFormSubmit}
            onCancel={() => setIsFormOpen(false)}
            onArchive={handleArchiveBatch}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isTransplantFormOpen} onOpenChange={setIsTransplantFormOpen}>
        <DialogContent className="max-w-2xl">
          <TransplantForm
            batch={transplantingBatch}
            onSubmit={handleTransplantFormSubmit}
            onCancel={() => setIsTransplantFormOpen(false)}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={isActionLogFormOpen} onOpenChange={setIsActionLogFormOpen}>
        <DialogContent className="max-w-2xl">
          <ActionLogForm
            batch={actionLogBatch}
            onSubmit={handleActionLogFormSubmit}
            onCancel={() => setIsActionLogFormOpen(false)}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
          />
        </DialogContent>
      </Dialog>
      
      <ProductionProtocolDialog
        open={isProtocolDialogOpen}
        onOpenChange={setIsProtocolDialogOpen}
        batch={protocolBatch}
      />

      <ScannerDialog 
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScanSuccess={handleScanSuccess}
      />
      
      <ScannedBatchActionsDialog
        open={isScannedActionsOpen}
        onOpenChange={setIsScannedActionsOpen}
        batch={scannedBatch}
        onLogAction={() => {
            setIsScannedActionsOpen(false);
            if (scannedBatch) handleLogAction(scannedBatch);
        }}
        onTransplant={() => {
            setIsScannedActionsOpen(false);
            if (scannedBatch) handleTransplantBatch(scannedBatch);
        }}
        onEdit={() => {
            setIsScannedActionsOpen(false);
            if (scannedBatch) handleEditBatch(scannedBatch);
        }}
        onGenerateProtocol={() => {
            setIsScannedActionsOpen(false);
            if (scannedBatch) handleGenerateProtocol(scannedBatch);
        }}
      />
    </div>
  );
}

    