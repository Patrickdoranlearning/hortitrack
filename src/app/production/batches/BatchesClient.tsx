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
} from 'lucide-react';
import type { Batch } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from 'next/link';
import { TransplantIcon } from '@/components/icons';
import { FeatureGate } from '@/components/FeatureGate';
import { BatchDetailDialog } from "@/components/batch-detail-dialog";
import { NewBatchButton } from '@/components/horti/NewBatchButton';
import ScannerDialog from '@/components/scan-and-act-dialog';
import { ActionDialog } from '@/components/actions/ActionDialog';
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // UseSWR for fetching batches from Supabase, with initialData from SSR
  const { data: batchesResult, error: batchesError, isLoading: isDataLoading } = useSWR(
    'batches', 
    getBatchesAction, 
    { fallbackData: { success: true, data: initialBatches } }
  );
  const batches = batchesResult?.data || [];
  
  if (batchesError) console.error("Error fetching batches:", batchesError);


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

  const handleLogAction = (batch: Batch) => {
    setSelectedBatch(batch);
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
                    <NewBatchButton />
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
                {statuses.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
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
        locations={[]}
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
