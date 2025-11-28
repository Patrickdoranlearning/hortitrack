

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
import {
  ActionLogFormValues,
  Batch,
  NurseryLocation,
  PlantSize,
  Supplier,
  Variety,
} from '@/lib/types';
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
import dynamic from 'next/dynamic';
import { ActionDialog } from '../components/actions/ActionDialog';
import { BatchCard } from '../components/batch-card';
import { BatchDetailDialog } from '../components/batch-detail-dialog';
import { CareRecommendationsDialog } from '../components/care-recommendations-dialog';
import { ProductionProtocolDialog } from '../components/production-protocol-dialog';
import ScannerDialog from '../components/scan-and-act-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FeatureGate } from '@/components/FeatureGate';
import { queryMatchesBatch } from '@/lib/search';
import BatchLabelPreview from '@/components/BatchLabelPreview';
import { TransplantIcon, CareIcon } from '@/components/icons';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import CheckInForm from '@/components/batches/CheckInForm';
import { useCollection } from '@/hooks/useCollection'; 
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { useActiveOrg } from '@/lib/org/context';
import { supabaseClient } from '@/lib/supabase/client'; 
import EditBatchForm from '@/components/batches/EditBatchForm';

const PropagationForm = dynamic(() => import('@/components/batches/PropagationForm'), { ssr: false });
const VarietyForm = dynamic(() => import('@/components/varieties/VarietyForm'), { ssr: false });

interface HomePageViewProps {
  initialBatches: Batch[];
  plantFamilies: string[];
  categories: string[];
  actions: {
    addBatch: (data: Omit<Batch, 'id' | 'batchNumber' | 'createdAt' | 'updatedAt' | 'logHistory'>) => Promise<any>;
    updateBatch: (data: Batch) => Promise<any>;
    archiveBatch: (batchId: string, loss: number) => Promise<any>;
    transplantBatch: (sourceBatchId: string, newBatchData: Omit<Batch, 'id' | 'batchNumber' | 'logHistory' | 'transplantedFrom' | 'createdAt' | 'updatedAt'>, transplantQuantity: number, logRemainingAsLoss: boolean) => Promise<any>;
    logAction: (batchId: string, logData: Partial<ActionLogFormValues>) => Promise<any>;
    addVariety: (data: Omit<Variety, 'id'>) => Promise<any>;
  };
}

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
  const { orgId, setOrgId } = useActiveOrg();

  const isReadonly = !user;

  // Use the server-fetched data directly
  const [batches, setBatches] = React.useState(initialBatches);

  React.useEffect(() => {
    // If no active org yet, but we loaded batches, pick their org
    if (!orgId && batches?.length && (batches[0] as any).orgId) {
        setOrgId((batches[0]as any).orgId);
    }
  }, [orgId, batches, setOrgId]);

  const { data: nurseryLocations, forceRefresh } = useCollection<NurseryLocation>("nursery_locations");

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = React.useState(false);
  const [isLogActionOpen, setIsLogActionOpen] = React.useState(false);
  const [isTransplantOpen, setIsTransplantOpen] = React.useState(false);
  const [isProtocolOpen, setIsProtocolOpen] = React.useState(false);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = React.useState(false);
  const [isVarietyFormOpen, setIsVarietyFormOpen] = React.useState(false);
  const [isScanOpen, setIsScanOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isNewPropagationOpen, setIsNewPropagationOpen] = React.useState(false);
  const [isCheckinFormOpen, setIsCheckinFormOpen] = React.useState(false);

  const [selectedBatch, setSelectedBatch] = React.useState<Batch | null>(null);
  const [editingBatch, setEditingBatch] = React.useState<Batch | null>(null);
  const [newVarietyName, setNewVarietyName] = React.useState('');
  
  const [filters, setFilters] = React.useState({
    plantFamily: 'all',
    category: 'all',
    status: 'Active',
  });
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredBatches = React.useMemo(() => {
    const dataToFilter = batches || [];
    const q = (searchQuery || '').trim();
    return dataToFilter
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
  }, [batches, searchQuery, filters]);

  const handleSignOut = async () => {
    const supabase = supabaseClient();
    await supabase.auth.signOut();
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
  
  const handleOpenDetail = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsDetailDialogOpen(true);
  };

  const handleLogAction = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsLogActionOpen(true);
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

  const handleAiCareClick = async () => {
    if (!batches || batches.length === 0) return;
    const batchForRecs = batches[0];
    setSelectedBatch(batchForRecs);
    setIsRecommendationsOpen(true);
  };
  
  const handleScanDetected = (text: string) => {
    window.location.href = `/?batch=${encodeURIComponent(text)}`;
  };
  
  const handleEditBatch = React.useCallback((batch: Batch) => {
    setEditingBatch(batch);
    setIsDetailDialogOpen(false);
  }, []);

  React.useEffect(() => {
    if (!isDetailDialogOpen && editingBatch) {
      const t = setTimeout(() => setIsFormOpen(true), 50);
      return () => clearTimeout(t);
    }
  }, [isDetailDialogOpen, editingBatch]);

  React.useEffect(() => {
    if (isFormOpen) {
      const id = requestAnimationFrame(() => {
        (document.querySelector('[data-autofocus="plant-variety"]') as HTMLElement | null)?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isFormOpen]);


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

  // `useEffect` above handles redirect when user is missing; render nothing while it runs.
  if (!user) return null;

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <div className="space-y-6">
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
                        disabled={!batches || batches.length === 0}
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
                                setIsNewPropagationOpen(true);
                            }}>
                                Propagation
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => {
                                setIsCheckinFormOpen(true);
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
      </div>

      {/* Dialogs */}
      
      {selectedBatch && (
        <BatchDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          batch={selectedBatch}
          onEdit={() => handleEditBatch(selectedBatch)}
          onTransplant={() => {}}
          onLogAction={handleLogAction}
          onGenerateProtocol={handleGenerateProtocol}
          onCareRecommendations={handleRecommendations}
        />
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBatch ? 'Edit Batch' : 'New Batch'}</DialogTitle>
            </DialogHeader>
            <EditBatchForm
              batch={editingBatch}
              onSubmitSuccess={(res) => {
                toast({
                  title: editingBatch ? 'Batch Updated' : 'Batch Created',
                  description: `Batch #${res.batchNumber} has been saved.`,
                });
                setIsFormOpen(false);
                setEditingBatch(null);
                // In a real app, you'd refetch or update the local state
              }}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingBatch(null);
              }}
              onArchive={async (batchId) => {
                await actions.archiveBatch(batchId, 0); // Assuming 0 loss for now
                toast({ title: 'Batch Archived' });
                setIsFormOpen(false);
                setEditingBatch(null);
              }}
              onCreateNewVariety={(name) => {
                setNewVarietyName(name);
                setIsVarietyFormOpen(true);
              }}
            />
          </DialogContent>
        </Dialog>


      <ActionDialog
        open={isLogActionOpen}
        onOpenChange={setIsLogActionOpen}
        defaultBatchIds={selectedBatch ? [selectedBatch.id!] : []}
        locations={nurseryLocations || []}
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

      {/* New Propagation Dialog */}
      <Dialog open={isNewPropagationOpen} onOpenChange={setIsNewPropagationOpen}>
        <DialogContent
          aria-describedby="new-propagation-desc"
          size="xl"
          className="grid grid-rows-[auto_1fr_auto] max-h-[calc(100dvh-2rem)] overflow-hidden"
        >
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle className="font-headline text-3xl">Start Propagation</DialogTitle>
            <DialogDescription id="new-propagation-desc">
              Pick variety, tray size, quantity and starting location for propagation.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-y-contain pr-6">
            <PropagationForm />
          </div>
        </DialogContent>
      </Dialog>

      {/* Check-in Batch Dialog */}
      <Dialog open={isCheckinFormOpen} onOpenChange={setIsCheckinFormOpen}>
        <DialogContent
          aria-describedby="checkin-desc"
          size="xl"
          className="grid grid-rows-[auto_1fr_auto] max-h-[calc(100dvh-2rem)] overflow-hidden"
        >
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle className="font-headline text-3xl">Check-in New Batch</DialogTitle>
            <DialogDescription id="checkin-desc">
              Enter variety, size, quantity, supplier, location, quality, and optional plant passport overrides.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-y-contain pr-6">
            <CheckInForm 
              onSubmitSuccess={(batch) => {
                const batchNumber = batch?.batch_number ?? batch?.batchNumber ?? "";
                toast({ title: "Check-in Successful", description: batchNumber ? `Batch #${batchNumber} created.` : "Batch created." });
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
        <DialogContent aria-describedby="variety-form-desc">
            <DialogHeader>
              <DialogTitle>New Variety</DialogTitle>
              <DialogDescription id="variety-form-desc">
                Fill in the plant variety details.
              </DialogDescription>
            </DialogHeader>
            <VarietyForm
                variety={{ name: newVarietyName } as Variety}
                onSubmit={async (data) => {
                const supabase = supabaseClient();
                const { error } = await supabase.from('plant_varieties').insert({
                    name: data.name, genus: data.genus, species: data.species, family: data.family, notes: data.notes
                });
                if (error) {
                    toast({ variant: 'destructive', title: 'Failed to create variety', description: error.message });
                    throw error;
                };
                setIsVarietyFormOpen(false);
                setNewVarietyName('');
                }}
                onCancel={() => setIsVarietyFormOpen(false)}
            />
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
