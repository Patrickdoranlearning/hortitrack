
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
  Menu,
} from 'lucide-react';
import type { Batch, NurseryLocation, PlantSize, Supplier, Variety } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BatchCard } from '@/components/batch-card';
import { BatchForm, type BatchDistribution } from '@/components/batch-form';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Logo } from '@/components/logo';
import { TransplantForm } from '@/components/transplant-form';
import { ActionLogForm } from '@/components/action-log-form';
import { INITIAL_PLANT_SIZES } from '@/lib/constants';
import Link from 'next/link';
import { ScannerDialog } from '@/components/scanner-dialog';
import { useToast } from '@/hooks/use-toast';
import type { TransplantFormData } from '@/lib/types';
import { ScannedBatchActionsDialog } from '@/components/scanned-batch-actions-dialog';
import { ProductionProtocolDialog } from '@/components/production-protocol-dialog';
import { 
  addBatchAction, 
  updateBatchAction, 
  archiveBatchAction, 
  transplantBatchAction,
  logAction
} from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { BatchDetailDialog } from '@/components/batch-detail-dialog';
import { INITIAL_SUPPLIERS } from '@/lib/suppliers';


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

  const [nurseryLocations, setNurseryLocations] = useState<NurseryLocation[]>([]);
  const [plantSizes, setPlantSizes] = useState<PlantSize[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);

  const [isProtocolDialogOpen, setIsProtocolDialogOpen] = useState(false);
  const [protocolBatch, setProtocolBatch] = useState<Batch | null>(null);
  
  const [batchDistribution, setBatchDistribution] = useState<BatchDistribution | null>(null);
  
  const [isClient, setIsClient] = useState(false);
  
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  const loadBatches = useCallback(() => {
    if (!user) return;
    setIsDataLoading(true);
    
    const q = query(collection(db, 'batches'), orderBy('batchNumber', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const batchesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Batch);
      setBatches(batchesData);
      setIsDataLoading(false);
    }, (error) => {
      console.error("Failed to subscribe to batch updates:", error);
      toast({ variant: 'destructive', title: 'Error loading batches', description: error.message });
      setIsDataLoading(false);
    });

    return unsubscribe;
  }, [user, toast]);
  
  const subscribeToCollection = useCallback(<T,>(
    collectionName: string, 
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    initialData: T[] = []
  ) => {
    if (!user) return () => {};

    const q = query(collection(db, collectionName));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            setter(initialData);
        } else {
            const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as T);
            setter(data);
        }
    }, (error) => {
        console.error(`Failed to subscribe to ${collectionName}:`, error);
        toast({ variant: 'destructive', title: `Error loading ${collectionName}`, description: error.message });
        setter(initialData);
    });

    return unsubscribe;
  }, [user, toast]);

  useEffect(() => {
    setIsClient(true);
    let unsubBatches: (() => void) | undefined;
    if (user) {
        unsubBatches = loadBatches();
    }
    
    // Subscribe to all golden tables
    const unsubVarieties = subscribeToCollection<Variety>('varieties', setVarieties);
    const unsubLocations = subscribeToCollection<NurseryLocation>('locations', setNurseryLocations);
    const unsubSizes = subscribeToCollection<PlantSize>('sizes', setPlantSizes, INITIAL_PLANT_SIZES);
    const unsubSuppliers = subscribeToCollection<Supplier>('suppliers', setSuppliers, INITIAL_SUPPLIERS);
    
    return () => {
      if (unsubBatches) unsubBatches();
      unsubVarieties();
      unsubLocations();
      unsubSizes();
      unsubSuppliers();
    };
  }, [user, loadBatches, subscribeToCollection]);

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

  const handleNewBatch = () => {
    setEditingBatch(null);
    setBatchDistribution(null);
    setIsFormOpen(true);
  };

  const handleEditBatch = (batch: Batch) => {
    const transplantedQuantity = batch.logHistory
      .filter(log => log.type === 'TRANSPLANT_TO' && typeof log.qty === 'number')
      .reduce((sum, log) => sum - log.qty!, 0); // qty is negative
      
    const lostQuantity = batch.logHistory
      .filter(log => log.type === 'LOSS' && typeof log.qty === 'number')
      .reduce((sum, log) => sum + log.qty!, 0);

    setBatchDistribution({
      inStock: batch.quantity,
      transplanted: transplantedQuantity,
      lost: lostQuantity,
    });
    setEditingBatch(batch);
    setIsFormOpen(true);
    setIsDetailDialogOpen(false);
  };

  const handleArchiveBatch = async (batchId: string) => {
    const batchToArchive = batches.find(b => b.id === batchId);
    if (!batchToArchive) return;
    
    const loss = batchToArchive.quantity;
    const result = await archiveBatchAction(batchId, loss);

    if (result.success) {
      toast({ title: "Success", description: `Batch #${batchToArchive.batchNumber} has been archived.` });
    } else {
      toast({ variant: 'destructive', title: 'Error archiving batch', description: result.error });
    }
    
    setIsFormOpen(false);
    setEditingBatch(null);
  }

  const handleFormSubmit = async (data: Omit<Batch, 'id' | 'batchNumber' | 'createdAt' | 'updatedAt'> & { id?: string; batchNumber?: string }) => {
    if (editingBatch) {
      const result = await updateBatchAction(data as Batch);
      if (result.success) {
        toast({ title: 'Batch Updated', description: `Batch #${result.data?.batchNumber} saved.`});
      } else {
        toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
      }
    } else {
      const newBatchData = { 
        ...data, 
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
    setIsFormOpen(false);
    setEditingBatch(null);
    setBatchDistribution(null);
  };

  const handleTransplantBatch = (batch: Batch) => {
    setTransplantingBatch(batch);
    setIsTransplantFormOpen(true);
    setIsDetailDialogOpen(false);
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
    } else {
      toast({ variant: 'destructive', title: 'Transplant Failed', description: result.error });
    }
    
    setIsTransplantFormOpen(false);
    setTransplantingBatch(null);
  };

  const handleLogAction = (batch: Batch) => {
    setActionLogBatch(batch);
    setIsActionLogFormOpen(true);
    setIsDetailDialogOpen(false);
  };
  
  const handleActionLogFormSubmit = async (data: any) => {
    if (!actionLogBatch) return;

    let logData: any = { type: data.actionType };

    switch (data.actionType) {
      case 'NOTE':
        logData.note = data.note;
        break;
      case 'MOVE':
        logData.note = `Moved batch from ${actionLogBatch.location} to ${data.newLocation}`;
        logData.newLocation = data.newLocation;
        break;
      case 'LOSS':
        logData.note = `Logged loss of ${data.qty}. Reason: ${data.reason}`;
        logData.qty = data.qty;
        logData.reason = data.reason;
        break;
      case 'Batch Spaced':
      case 'Batch Trimmed':
        logData.note = data.actionType;
        break;
      default:
        toast({ variant: 'destructive', title: 'Invalid Action', description: 'The selected action is not supported.' });
        return;
    }

    const result = await logAction(actionLogBatch.id, logData);

    if (result.success) {
      toast({ title: 'Action Logged', description: 'The action has been successfully logged.' });
    } else {
      toast({ variant: 'destructive', title: 'Logging Failed', description: result.error });
    }
    
    setIsActionLogFormOpen(false);
    setActionLogBatch(null);
  };

  const handleScanSuccess = (scannedData: string) => {
    const trimmedScan = scannedData.trim().toLowerCase();
    const foundBatch = batches.find(b => b.batchNumber.trim().toLowerCase() === trimmedScan);
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
    setIsDetailDialogOpen(false);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
    toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
  };

  const handleCardClick = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsDetailDialogOpen(true);
  }
  
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
      <header className="sticky top-0 z-30 flex h-auto flex-col gap-4 border-b bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          {/* Desktop Menu */}
          <div className="hidden items-center gap-2 md:flex">
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
            <Button onClick={handleNewBatch} size="lg">
                <PlusCircle />
                New Batch
            </Button>
            <Button onClick={handleSignOut} variant="ghost" size="icon">
                <LogOut />
                <span className="sr-only">Sign Out</span>
            </Button>
          </div>
          {/* Mobile Menu */}
          <div className="flex items-center gap-2 md:hidden">
            <Button onClick={() => setIsScannerOpen(true)} size="icon" variant="outline">
                <ScanLine />
                <span className="sr-only">Scan</span>
            </Button>
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                        <Menu />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <div className="flex flex-col gap-4">
                        <SheetClose asChild>
                            <Button onClick={handleNewBatch} className="w-full">
                                <PlusCircle />
                                New Batch
                            </Button>
                        </SheetClose>
                        <SheetClose asChild>
                             <Button asChild variant="outline" className="w-full">
                                <Link href="/dashboard">
                                    <LayoutDashboard />
                                    Dashboard
                                </Link>
                            </Button>
                        </SheetClose>
                         <SheetClose asChild>
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/settings">
                                    <Database />
                                    Manage Data
                                </Link>
                            </Button>
                        </SheetClose>
                        <SheetClose asChild>
                            <Button onClick={handleSignOut} variant="ghost" className="w-full">
                                <LogOut />
                                Sign Out
                            </Button>
                        </SheetClose>
                    </div>
                </SheetContent>
            </Sheet>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by category, family, variety..."
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
             <Button onClick={() => setIsScannerOpen(true)} className="hidden sm:inline-flex">
                <ScanLine />
                Scan Code
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shrink-0 w-full sm:w-auto">
                  <Filter className="mr-2" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={filters.status} onValueChange={(value) => setFilters(f => ({ ...f, status: value }))}>
                  {statuses.map(status => (
                    <DropdownMenuRadioItem key={status} value={status}>{status === 'all' ? 'All Statuses' : status}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={filters.category} onValueChange={(value) => setFilters(f => ({ ...f, category: value }))}>
                  {categories.map(cat => (
                    <DropdownMenuRadioItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                
                <DropdownMenuLabel>Filter by Plant Family</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={filters.plantFamily} onValueChange={(value) => setFilters(f => ({ ...f, plantFamily: value }))}>
                  {plantFamilies.map(fam => (
                    <DropdownMenuRadioItem key={fam} value={fam}>{fam === 'all' ? 'All Families' : fam}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

              </DropdownMenuContent>
            </DropdownMenu>
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
                  onClick={handleCardClick}
                  onLogAction={handleLogAction}
                  onTransplant={handleTransplantBatch}
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
            suppliers={suppliers}
            varieties={varieties}
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
      
      <BatchDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        batch={selectedBatch}
        onEdit={handleEditBatch}
        onTransplant={handleTransplantBatch}
        onLogAction={handleLogAction}
        onGenerateProtocol={handleGenerateProtocol}
      />
    </div>
  );
}
