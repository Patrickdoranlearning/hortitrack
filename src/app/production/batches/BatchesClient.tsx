'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from 'swr';

import {
  Search,
  Filter,
  QrCode,
  Sparkles,
  Printer,
  ClipboardList,
} from 'lucide-react';
import type { Batch, NurseryLocation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from 'next/link';
import { TransplantIcon } from '@/components/icons';
import { FeatureGate } from '@/components/FeatureGate';
import { BatchDetailDialog } from "@/components/batch-detail-dialog";
import { NewBatchButton } from '@/components/horti/NewBatchButton';
import { TransplantMenuButton } from "@/components/horti/TransplantMenuButton";
import ScannerDialog from '@/components/scan-and-act-dialog';
import { ActionDialog } from '@/components/actions/ActionDialog';
import type { ActionMode } from "@/components/actions/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { queryMatchesBatch } from '@/lib/search';
import { getBatchesAction } from '@/app/actions';
import { BatchCard } from '@/components/batch-card';
import { Grid } from 'lucide-react';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import BatchLabelPreview from '@/components/BatchLabelPreview';
import { fetchJson } from '@/lib/http';


export default function BatchesClient({ initialBatches }: { initialBatches: Batch[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlBatch = searchParams.get("batch");
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    plantFamily: string;
    status: string;
    category: string;
  }>({ plantFamily: 'all', status: 'all', category: 'all' });

  const { toast } = useToast();

  // State for dialogs
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isLogActionOpen, setIsLogActionOpen] = useState(false);
  const [logActionMode, setLogActionMode] = useState<ActionMode>("MOVE");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // UseSWR for fetching batches from Supabase, with initialData from SSR
  const { data: batchesResult, error: batchesError, isLoading: isDataLoading, mutate: mutateBatches } = useSWR(
    'batches', 
    getBatchesAction, 
    { fallbackData: { success: true, data: initialBatches } }
  );
  const batches = batchesResult?.data || [];

  const handleActionSuccess = React.useCallback(() => {
    // Refresh the batches list after an action
    mutateBatches();
    // Also update the selected batch if it exists
    if (selectedBatch?.id) {
      const updated = batches.find((b) => b.id === selectedBatch.id);
      if (updated) setSelectedBatch(updated);
    }
  }, [mutateBatches, selectedBatch?.id, batches]);

  const { data: locationsData, error: locationsError } = useSWR(
    "catalog/locations",
    () => fetchJson<{ value: string; label: string }[]>("/api/catalog/locations")
  );

  const nurseryLocations = useMemo<NurseryLocation[]>(() => {
    if (!locationsData) return [];
    const orgId = batches[0]?.orgId ?? "";
    return locationsData.map((loc) => ({
      id: loc.value,
      name: loc.label,
      orgId,
    }));
  }, [locationsData, batches]);
  
  if (batchesError) console.error("Error fetching batches:", batchesError);
  useEffect(() => {
    if (locationsError) {
      console.error("Error loading locations:", locationsError);
      toast({
        variant: "destructive",
        title: "Locations unavailable",
        description: "Could not load nursery locations. Please refresh and try again.",
      });
    }
  }, [locationsError, toast]);


  // Open dialog if ?batch=<id> present
  useEffect(() => {
    if (!urlBatch || !batches?.length) return;
    const b = batches.find(x => x.id === urlBatch || x.batchNumber === urlBatch);
    if (b) {
      setSelectedBatch(b);
      setIsDetailDialogOpen(true);
    }
  }, [urlBatch, batches]);


  const plantFamilies = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.plantFamily).filter(Boolean)))], [batches]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.category).filter(Boolean)))], [batches]);
  const statuses = useMemo(() => ['all', ...Array.from(new Set(batches.map(b => b.status)))], [batches]);

  const filteredBatches = useMemo(() => {
    const q = (searchQuery || '').trim();
    return batches
      .filter((batch) => queryMatchesBatch(q, batch))
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
        return batch.status === filters.status;
      });
  }, [batches, searchQuery, filters]);

  const handleViewDetails = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsDetailDialogOpen(true);
  };
  
  const handleEditBatch = (batch: Batch) => {
    // Logic to open an edit form/dialog
    console.log("Editing batch:", batch);
  };

  const handleLogAction = (batch: Batch, mode: ActionMode) => {
    setSelectedBatch(batch);
    setLogActionMode(mode);
    setIsLogActionOpen(true);
  };

  const handlePrintClick = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsPreviewOpen(true);
  }

  const handleScanDetected = React.useCallback(
    async (text: string) => {
      if (!text) return;
      try {
        // Simple redirect to homepage with batch param if we can find it
        router.push(`/?batch=${encodeURIComponent(text)}`);
        setIsScanOpen(false);
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Scan failed",
          description: err?.message || "Could not look up that batch.",
        });
      }
    },
    [router, toast]
  );
  
  if (isDataLoading && !batches.length) {
     return (
        <div className="flex min-h-screen w-full flex-col p-6 items-center justify-center">
            <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
    );
  }

  return (
     <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <div className="space-y-6">
        <ModulePageHeader 
            title="All Batches"
            description="View, search, and manage all batch records."
            actionsSlot={
                <>
                    <Button
                        variant="outline"
                        onClick={() => setIsScanOpen(true)}
                        className="w-full sm:w-auto"
                    >
                        <QrCode className="mr-2 h-4 w-4" />
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
                        variant="outline"
                        disabled={!batches || batches.length === 0}
                        className="w-full sm:w-auto"
                    >
                        <Sparkles className="mr-2 h-4 w-4" /> AI Care
                    </Button>
                    </FeatureGate>
                    <Button variant="outline" className="w-full sm:w-auto" asChild>
                      <Link href="/actions">
                        <ClipboardList className="mr-2 h-4 w-4" /> Log Actions
                      </Link>
                    </Button>
                    <NewBatchButton />
                    <TransplantMenuButton />
                </>
            }
        />
        
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuRadioGroup 
                value={filters.status} 
                onValueChange={(value) => setFilters((f) => ({ ...f, status: value }))}
              >
                <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                {statuses.filter(s => s !== 'all').map(status => (
                    <DropdownMenuRadioItem key={status} value={status}>{status}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Category</DropdownMenuLabel>
              <DropdownMenuRadioGroup 
                value={filters.category} 
                onValueChange={(value) => setFilters((f) => ({ ...f, category: value }))}
              >
                <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                {(categories || []).filter(c => c !== 'all').map((c) => (
                  <DropdownMenuRadioItem key={c} value={c}>{c}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Family</DropdownMenuLabel>
              <DropdownMenuRadioGroup 
                value={filters.plantFamily} 
                onValueChange={(value) => setFilters((f) => ({ ...f, plantFamily: value }))}
              >
                <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                {(plantFamilies || []).filter(p => p !== 'all').map((p) => (
                  <DropdownMenuRadioItem key={p} value={p}>{p}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {isDataLoading ? (
              [...Array(9)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
          ) : (
              filteredBatches.map((batch) => (
                <BatchCard
                  key={batch.id}
                  batch={batch}
                  onOpen={handleViewDetails}
                  onLogAction={handleLogAction}
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
              ))
          )}
          </div>
          {filteredBatches.length === 0 && !isDataLoading && (
              <div className="text-center col-span-full py-20">
                    <Grid className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Batches Found</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    Try adjusting your search or filters.
                </p>
            </div>
        )}

      <BatchDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        batch={selectedBatch}
        onEdit={handleEditBatch}
        onTransplant={() => {}}
        onLogAction={handleLogAction}
        onGenerateProtocol={() => {}}
        onCareRecommendations={() => {}}
      />
      <ScannerDialog 
        open={isScanOpen} 
        onOpenChange={setIsScanOpen} 
        onDetected={handleScanDetected}
      />
      <ActionDialog
        open={isLogActionOpen}
        onOpenChange={setIsLogActionOpen}
        batch={selectedBatch}
        locations={nurseryLocations}
        mode={logActionMode}
        onSuccess={handleActionSuccess}
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
    </PageFrame>
  );
}
