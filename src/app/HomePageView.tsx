
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
import { useAuth } from '@/hooks/use-auth'; // Assuming this useAuth is now Supabase-backed or will be removed
import { useToast } from '@/hooks/use-toast';
// import { auth } from '@/lib/firebase'; // Removed Firebase auth import
import {
  ActionLogFormValues,
  Batch,
  NurseryLocation,
  PlantSize,
  Supplier,
  Variety,
} from '@/lib/types';
// import { signOut } from 'firebase/auth'; // Removed Firebase signOut import
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
import { CareRecommendationsDialog } from '../components/care-recommendations-dialog';
import { ProductionProtocolDialog } from '../components/production-protocol-dialog';
import ScannerDialog from '../components/scan-and-act-dialog';
import { Dialog } from '@/components/ui/dialog';
import { FeatureGate } from '@/components/FeatureGate';
import { getIdTokenOrNull } from "@/lib/auth/client";
import { queryMatchesBatch } from '@/lib/search';
import BatchLabelPreview from '@/components/BatchLabelPreview';
import { TransplantIcon, CareIcon } from '@/components/icons';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckinDialog } from '@/components/checkin-dialog';

import { useCollection } from '@/hooks/useCollection'; // NEW Supabase-powered useCollection
import { getBatchesAction } from './actions'; // Supabase-backed server action
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { useActiveOrg } from '@/server/org/context'; // To get the active org ID
import { CheckinForm } from '@/components/batches/CheckInForm';

interface HomePageViewProps {
  initialBatches: Batch[];
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
        | 'updatedId'
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

const TABS = [
    { label: "Production", href: "/" },
    { label: "Sales", href: "/sales" },
    { label: "Actions", href: "/actions" },
];

export default function HomePageView({
  initialBatches,
  plantFamilies,
  categories,
  actions,
}: HomePageViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth(); 
  const searchParams = useSearchParams();
  const urlBatchId = searchParams.get("batch");
  const activeOrgId = useActiveOrg(); // Get active org ID from context

  const isReadonly = !user;

  // Use new Supabase-powered useCollection for batches
  const { data: batchesData, forceRefresh } = useCollection<Batch>("batches", initialBatches, {
    orderBy: { column: "created_at", ascending: false },
    filters: activeOrgId ? [{ column: "org_id", value: activeOrgId }] : [],
  });
  const batches = batchesData || [];

  // Dynamically fetch other reference data with useCollection
  const { data: varieties } = useCollection<Variety>("varieties", [], { realtime: true });
  const { data: nurseryLocations } = useCollection<NurseryLocation>("locations", [], { realtime: true });
  const { data: plantSizes } = useCollection<PlantSize>("sizes", [], { realtime: true });
  const { data: suppliers } = useCollection<Supplier>("suppliers", [], { realtime: true });

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
  const [isCheckinFormOpen, setIsCheckinFormOpen] = React.useState(false); // State for CheckinForm

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
    // Supabase signOut equivalent
    // You'll need to replace `auth` with your Supabase client instance if you have one on the client
    // For example: `const supabase = createClientComponentClient(); await supabase.auth.signOut();`
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
    // These actions need to be updated to use Supabase if they are not already
    const result = selectedBatch
      ? await actions.updateBatch(data)
      : await actions.addBatch(data);
    if (result?.success) {
      setIsFormOpen(false);
      setSelectedBatch(null);
      forceRefresh(); // Refresh batches after create/update
    }
  };

  const handleArchive = async (batchId: string) => {
    // This action needs to be updated to use Supabase if not already
    await actions.archiveBatch(batchId, selectedBatch?.quantity || 0);
    setIsFormOpen(false);
    setSelectedBatch(null);
    forceRefresh(); // Refresh batches after archive
  };

  const handleLogActionSubmit = async (values: ActionLogFormValues) => {
    if (!selectedBatch?.id) return;
    // This action needs to be updated to use Supabase if not already
    await actions.logAction(selectedBatch.id, values);
    setIsLogActionOpen(false);
    setSelectedBatch(null);
    forceRefresh(); // Refresh batches after logging action
  };

  const handleTransplantSubmit = async (data: TransplantFormData) => {
    const sourceBatchId = selectedBatch?.id;
    const { quantity, logRemainingAsLoss, ...newBatchData } = data;

    if (!sourceBatchId) {
      // This action needs to be updated to use Supabase if not already
      await actions.addBatch({
        ...newBatchData,
        quantity,
      } as Omit<Batch, 'id' | 'batchNumber' | 'createdAt' | 'updatedAt' | 'logHistory'>);
    } else {
      // This action needs to be updated to use Supabase if not already
      await actions.transplantBatch(
        sourceBatchId,
        newBatchData,
        quantity,
        logRemainingAsLoss
      );
    }
    setIsTransplantOpen(false);
    setIsNewPropagationOpen(false); 
    setSelectedBatch(null);
    forceRefresh(); // Refresh batches after transplant
  };

  const handleCreateNewVariety = (name: string) => {
    setNewVarietyName(name);
    setIsVarietyFormOpen(true);
  };

  const handleVarietyFormSubmit = async (data: Omit<Variety, 'id'>) => {
    // This action needs to be updated to use Supabase if not already
    const result = await actions.addVariety(data);
    if (result.success) {
      setIsVarietyFormOpen(false);
      // forceRefresh(); // Potentially refresh varieties, but useCollection will handle it
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
          <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
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
    <PageFrame companyName="Doran Nurseries" moduleKey="production" moduleTabs={TABS}>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <ModulePageHeader 
            title="Nursery Stock"
            description="A real-time overview of all plant batches currently in production."
            actionsSlot={
                <>
                    <Button
                        variant="outline"
                        onClick={() => setIsScanOpen(true)}
                        className="w-full sm:w-auto"
                    >
                        <QrCode />
                        Scan
                    </Button>
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                        type="search"
                        placeholder="Search..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <FeatureGate name="aiCare">
                    <Button
                        onClick={handleAiCareClick}
                        variant="outline"
                        disabled={batches.length === 0}
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
                            <DropdownMenuItem onSelect={() => {
                                setSelectedBatch(null);
                                setIsCheckinFormOpen(true); // Open CheckinForm
                            }}>
                                Check-in
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            }
        />

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

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
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
                                <Button variant="ghost" size="icon" disabled={batch.quantity === 0}>
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
      
      {selectedBatch && (
        <BatchDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          batch={selectedBatch}
          onEdit={() => {}}
          onTransplant={() => {}}
          onLogAction={handleLogAction}
          onGenerateProtocol={handleGenerateProtocol}
          onCareRecommendations={handleRecommendations}
        />
      )}

      <ActionDialog
        open={isLogActionOpen}
        onOpenChange={setIsLogActionOpen}
        defaultBatchIds={selectedBatch ? [selectedBatch.id!] : []}
        // Locations should be fetched dynamically inside ActionDialog now
        locations={[]}
      />
      
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

      {/* New Batch (Propagation) Dialog */}
      <Dialog open={isNewPropagationOpen} onOpenChange={setIsNewPropagationOpen}>
        <DialogContent size="xl" className="grid grid-rows-[auto_1fr_auto] max-h-[calc(100dvh-2rem)] overflow-hidden">
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle className="font-headline text-3xl">Create New Propagation Batch</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-y-contain pr-6">
            <BatchForm
              batch={null}
              onSubmitSuccess={(batch) => {
                toast({ title: "Propagation Batch Created", description: `Batch #${batch.batchNumber} successfully started.` });
                setIsNewPropagationOpen(false);
                forceRefresh();
              }}
              onCancel={() => setIsNewPropagationOpen(false)}
              onCreateNewVariety={handleCreateNewVariety} 
              // No need to pass varieties, locations, sizes, suppliers as BatchForm fetches them dynamically
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Check-in Batch Dialog */}
      <Dialog open={isCheckinFormOpen} onOpenChange={setIsCheckinFormOpen}>
        <DialogContent size="xl" className="grid grid-rows-[auto_1fr_auto] max-h-[calc(100dvh-2rem)] overflow-hidden">
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle className="font-headline text-3xl">Check-in New Batch</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-y-contain pr-6">
            <CheckinForm 
              onSubmitSuccess={(batch) => {
                toast({ title: "Check-in Successful", description: `Batch #${batch.batchNumber} created.` });
                setIsCheckinFormOpen(false); 
                forceRefresh(); 
              }}
              onCancel={() => setIsCheckinFormOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Other Dialogs */}
      <Dialog open={isVarietyFormOpen} onOpenChange={setIsVarietyFormOpen}>
        <DialogContent>
          <VarietyForm
            variety={{ name: newVarietyName } as Variety}
            onSubmit={handleVarietyFormSubmit}
            onCancel={() => setIsVarietyFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

    </PageFrame>
  );
}
