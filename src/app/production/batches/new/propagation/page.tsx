'use client';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import {
  ActionLogFormValues,
  Batch,
  NurseryLocation,
  PlantSize,
  Supplier,
  Variety,
} from '@/lib/types';
import { signOut } from 'firebase/auth';
import {
  Grid,
  LayoutGrid,
  LogOut,
  Plus,
  QrCode,
  Search,
  Settings,
  Sparkles,
  Users,
  Printer,
  MoreHorizontal,
  ShoppingCart,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { ActionDialog } from '../components/actions/ActionDialog';
import { BatchCard } from '../components/batch-card';
import { BatchDetailDialog } from '../components/batch-detail-dialog';
import { BatchForm } from '../components/batch-form';
import { CareRecommendationsDialog } from '../components/care-recommendations-dialog';
import { ProductionProtocolDialog } from '../components/production-protocol-dialog';
import ScannerDialog from '../components/scan-and-act-dialog';
import {
  TransplantForm,
  type TransplantFormData,
} from '../components/transplant-form';
import { VarietyForm } from '../components/variety-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useCollection } from '@/hooks/use-collection';
import { getCareRecommendationsAction } from './actions';
import { FeatureGate } from '@/components/FeatureGate';
import { getIdTokenOrNull } from "@/lib/auth/client"; // Import getIdTokenOrNull
import { queryMatchesBatch } from '@/lib/search';
import { parseScanCode } from '@/lib/scan/parse';
import BatchLabelPreview from '@/components/BatchLabelPreview';
import { TransplantIcon, CareIcon } from '@/components/icons';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckinDialog } from '@/components/checkin-dialog';

interface HomePageViewProps {
  initialBatches: Batch[];
  initialVarieties: Variety[];
  initialNurseryLocations: NurseryLocation[];
  initialPlantSizes: PlantSize[];
  initialSuppliers: Supplier[];
  plantFamilies: string[];
  categories: string[];
  actions: {
    addBatch: (
      data: Omit<Batch, 'id' | 'batchNumber' | 'createdAt' | 'updatedAt' | 'logHistory'>
    ) => Promise<any>;
    updateBatch: (data: Batch) => Promise<any>;
    archiveBatch: (batchId: string, loss: number) => Promise<any>;
    transplantBatch: (
      sourceBatchId: string,
      newBatchData: Omit<
        Batch,
        | 'id'
        | 'batchNumber'
        | 'logHistory'
        | 'transplantedFrom'
        | 'createdAt'
        | 'updatedAt'
      >,
      transplantQuantity: number,
      logRemainingAsLoss: boolean
    ) => Promise<any>;
    logAction: (
      batchId: string,
      logData: Partial<ActionLogFormValues>
    ) => Promise<any>;
    addVariety: (data: Omit<Variety, 'id'>) => Promise<any>;
  };
}

export default function HomePageView({
  initialBatches,
  initialVarieties,
  initialNurseryLocations,
  initialPlantSizes,
  initialSuppliers,
  plantFamilies,
  categories,
  actions,
}: HomePageViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const urlBatchId = searchParams.get("batch");

  const isReadonly = !user;

  const { data: batchesData, forceRefresh } = useCollection<Batch>('batches', initialBatches);
  const batches = batchesData || [];

  const { data: varieties } = useCollection<Variety>(
    'varieties',
    initialVarieties
  );
  const { data: nurseryLocations } = useCollection<NurseryLocation>(
    'locations',
    initialNurseryLocations
  );
  const { data: plantSizes } = useCollection<PlantSize>(
    'sizes',
    initialPlantSizes
  );
  const { data: suppliers } = useCollection<Supplier>(
    'suppliers',
    initialSuppliers
  );

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = React.useState(false);
  const [isLogActionOpen, setIsLogActionOpen] = React.useState(false);
  const [isTransplantOpen, setIsTransplantOpen] = React.useState(false);
  const [isProtocolOpen, setIsProtocolOpen] = React.useState(false);
  const [isRecommendationsOpen, setIsRecommendationsOpen] =
    React.useState(false);
  const [isVarietyFormOpen, setIsVarietyFormOpen] = React.useState(false);
  const [isScanOpen, setIsScanOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isNewPropagationOpen, setIsNewPropagationOpen] = React.useState(false);


  const [selectedBatch, setSelectedBatch] = React.useState<Batch | null>(null);
  const [newVarietyName, setNewVarietyName] = React.useState('');
  
  const [filters, setFilters] = React.useState({
    plantFamily: 'all',
    category: 'all',
    status: 'Active',
  });
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredBatches = React.useMemo(() => {
    const dataToFilter = isReadonly ? initialBatches : batches;
    const q = (searchQuery || '').trim();
    return (dataToFilter || [])
      .filter((batch) => queryMatchesBatch(q, batch))
      .filter((batch) =>
        filters.plantFamily === 'all' || batch.plantFamily === filters.plantFamily
      )
      .filter((batch) =>
        filters.category === 'all' || batch.category === filters.category
      )
      .filter((batch) => {
        if (filters.status === 'all') return true;
        if (filters.status === 'Active') return batch.status !== 'Archived';
        return batch.status === filters.status;
      });
  }, [isReadonly, initialBatches, batches, searchQuery, filters]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
    toast({
      title: 'Signed Out',
      description: 'You have been successfully signed out.',
    });
  };

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (!urlBatchId || !batches?.length) return;
    const b = batches.find(x => x.id === urlBatchId || x.batchNumber === urlBatchId);
    if (b) {
      setSelectedBatch(b);
      setIsDetailDialogOpen(true);
    }
  }, [urlBatchId, batches]);

  
  const handleOpenForm = (batch?: Batch) => {
    setSelectedBatch(batch || null);
    setIsFormOpen(true);
  };

  const handleOpenDetail = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsDetailDialogOpen(true);
  };

  const handleLogAction = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsLogActionOpen(true);
  };

  const handleTransplant = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsTransplantOpen(true);
  };
  
  const handlePrintClick = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsPreviewOpen(true);
  }

  const handleGenerateProtocol = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsProtocolOpen(true);
  };

  const handleRecommendations = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsRecommendationsOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    const result = selectedBatch
      ? await actions.updateBatch(data)
      : await actions.addBatch(data);
    if (result?.success) {
      setIsFormOpen(false);
      setSelectedBatch(null);
    }
  };

  const handleArchive = async (batchId: string) => {
    await actions.archiveBatch(batchId, selectedBatch?.quantity || 0);
    setIsFormOpen(false);
    setSelectedBatch(null);
  };

  const handleLogActionSubmit = async (values: ActionLogFormValues) => {
    if (!selectedBatch?.id) return;
    await actions.logAction(selectedBatch.id, values);
    setIsLogActionOpen(false);
    setSelectedBatch(null);
  };

  const handleTransplantSubmit = async (data: TransplantFormData) => {
    // If selectedBatch is null, it's a new propagation
    const sourceBatchId = selectedBatch?.id;
    const { quantity, logRemainingAsLoss, ...newBatchData } = data;

    // For new propagation, call addBatch directly, not transplantBatch
    if (!sourceBatchId) {
      await actions.addBatch({
        ...newBatchData,
        quantity,
      } as Omit<Batch, 'id' | 'batchNumber' | 'createdAt' | 'updatedAt' | 'logHistory'>);
    } else {
      await actions.transplantBatch(
        sourceBatchId,
        newBatchData,
        quantity,
        logRemainingAsLoss
      );
    }
    setIsTransplantOpen(false);
    setIsNewPropagationOpen(false); // Close the new propagation dialog
    setSelectedBatch(null);
  };

  const handleCreateNewVariety = (name: string) => {
    setNewVarietyName(name);
    setIsVarietyFormOpen(true);
  };

  const handleVarietyFormSubmit = async (data: Omit<Variety, 'id'>) => {
    const result = await actions.addVariety(data);
    if (result.success) {
      setIsVarietyFormOpen(false);
    }
  };

  const handleAiCareClick = async () => {
    if (!batches || batches.length === 0) return;
    const batchForRecs = batches[0];
    setSelectedBatch(batchForRecs);
    setIsRecommendationsOpen(true);
  };
  
  const handleScanDetected = (text: string) => {
    window.location.href = `/?batch=${encodeURIComponent(text)}`;
  };


  if (authLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col p-6">
        <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 justify-between">
          <Logo />
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 justify-between z-10">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="relative flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search #batch, ht:batch:…, variety…"
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredBatches.length > 0) {
                  setSelectedBatch(filteredBatches[0] as any);
                  setIsDetailDialogOpen(true);
                }
              }}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Users className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {user.email || 'My Account'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <LayoutGrid />
                  Production Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/sales">
                  <ShoppingCart />
                  Sales
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-headline text-3xl sm:text-4xl truncate">Nursery Stock</h1>
            <p className="text-muted-foreground">
              A real-time overview of all plant batches currently in production.
            </p>
          </div>
          <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsScanOpen(true)}
              disabled={isReadonly}
               className="w-full sm:w-auto"
            >
              <QrCode />
              Scan
            </Button>
            <FeatureGate name="aiCare">
              <Button
                onClick={handleAiCareClick}
                variant="outline"
                disabled={isReadonly || batches.length === 0}
                className="w-full sm:w-auto"
              >
                <Sparkles /> AI Care
              </Button>
            </FeatureGate>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isReadonly} className="w-full sm:w-auto">
                  <Plus /> New Batch
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => {
                  setSelectedBatch(null);
                  setIsNewPropagationOpen(true);
                }}>
                  Propagation
                </DropdownMenuItem>
                <CheckinDialog trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Check-in</DropdownMenuItem>} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Select
            value={filters.status}
            onValueChange={(value) =>
              setFilters((f) => ({ ...f, status: value }))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Propagation">Propagation</SelectItem>
              <SelectItem value="Plugs/Liners">Plugs/Liners</SelectItem>
              <SelectItem value="Potted">Potted</SelectItem>
              <SelectItem value="Ready for Sale">Ready for Sale</SelectItem>
              <SelectItem value="Looking Good">Looking Good</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.category}
            onValueChange={(value) =>
              setFilters((f) => ({ ...f, category: value }))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(categories || []).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.plantFamily}
            onValueChange={(value) =>
              setFilters((f) => ({ ...f, plantFamily: value }))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by family" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Families</SelectItem>
              {(plantFamilies || []).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          {authLoading
            ? [...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))
            : filteredBatches.map((batch) => (
                <BatchCard
                  key={batch.id}
                  batch={batch}
                  onOpen={handleOpenDetail}
                  actionsSlot={
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handlePrintClick(batch)}>
                                  <Printer className="h-5 w-5" />
                                  <span className="sr-only">Print Label</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Print Label</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleLogAction(batch)}>
                                  <CareIcon />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Log Action</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleTransplant(batch)} disabled={batch.quantity === 0}>
                                  <TransplantIcon />
                                  <span className="sr-only">Transplant</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Transplant</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                  }
                />
              ))}
        </div>
        {filteredBatches.length === 0 && !authLoading && (
          <div className="text-center col-span-full py-20">
            <Grid className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Batches Found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Try adjusting your filters or create a new batch.
            </p>
          </div>
        )}
      </main>

      {/* Dialogs */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent
            size="xl"
            className="grid grid-rows-[auto_1fr_auto] max-h-[calc(100dvh-2rem)] overflow-hidden"
          >
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle className="font-headline text-3xl">
              {selectedBatch ? 'Edit Batch' : 'Create New Batch'}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-y-contain pr-6">
            <BatchForm
              batch={selectedBatch}
              onSubmitSuccess={() => setIsFormOpen(false)}
              onCancel={() => setIsFormOpen(false)}
              onArchive={handleArchive}
              nurseryLocations={nurseryLocations || []}
              plantSizes={plantSizes || []}
              suppliers={suppliers || []}
              varieties={varieties || []}
              onCreateNewVariety={handleCreateNewVariety}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {selectedBatch && (
        <BatchDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          batch={selectedBatch}
          onEdit={handleOpenForm}
          onTransplant={handleTransplant}
          onLogAction={handleLogAction}
          onGenerateProtocol={handleGenerateProtocol}
          onCareRecommendations={handleRecommendations}
        />
      )}

      <ActionDialog
        open={isLogActionOpen}
        onOpenChange={setIsLogActionOpen}
        defaultBatchIds={selectedBatch ? [selectedBatch.id!] : []}
        locations={(nurseryLocations || []).map(l => ({ id: l.id!, name: l.name }))}
      />

      <Dialog open={isTransplantOpen || isNewPropagationOpen} onOpenChange={isNewPropagationOpen ? setIsNewPropagationOpen : setIsTransplantOpen}>
        <DialogContent className="max-w-4xl">
          <TransplantForm
            batch={selectedBatch}
            onSubmit={handleTransplantSubmit}
            onCancel={() => {
              setIsTransplantOpen(false);
              setIsNewPropagationOpen(false);
            }}
            nurseryLocations={nurseryLocations || []}
            plantSizes={plantSizes || []}
            isNewPropagation={isNewPropagationOpen} // New prop
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isVarietyFormOpen} onOpenChange={setIsVarietyFormOpen}>
        <DialogContent>
          <VarietyForm
            variety={{ name: newVarietyName } as Variety}
            onSubmit={handleVarietyFormSubmit}
            onCancel={() => setIsVarietyFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ProductionProtocolDialog
        open={isProtocolOpen}
        onOpenChange={setIsProtocolOpen}
        batchId={selectedBatch?.id}
      />
      <CareRecommendationsDialog
        open={isRecommendationsOpen}
        onOpenChange={setIsRecommendationsOpen}
        batchId={selectedBatch?.id}
      />
      <ScannerDialog 
        open={isScanOpen} 
        onOpenChange={setIsScanOpen} 
        onDetected={handleScanDetected}
      />
       {selectedBatch && <BatchLabelPreview
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        batch={{
          id: selectedBatch.id!,
          batchNumber: selectedBatch.batchNumber,
          plantVariety: selectedBatch.plantVariety,
          plantFamily: selectedBatch.plantFamily,
          size: selectedBatch.size,
          location: selectedBatch.location,
          initialQuantity: selectedBatch.initialQuantity ?? selectedBatch.quantity ?? 0,
          quantity: selectedBatch.quantity,
        }}
      />}
    </div>
  );
}