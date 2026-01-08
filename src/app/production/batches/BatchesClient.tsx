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
  LayoutGrid,
  List,
  ClipboardList,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
import { ActionMenuButton } from '@/components/actions/ActionMenuButton';
import type { ActionMode } from "@/components/actions/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { queryMatchesBatch } from '@/lib/search';
import { getBatchesAction } from '@/app/actions';
import { BatchCard } from '@/components/batch-card';
import { Grid } from 'lucide-react';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import BatchLabelPreview from '@/components/BatchLabelPreview';
import { Badge } from "@/components/ui/badge";
import { fetchJson } from '@/lib/http';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import TransplantForm from '@/components/batches/TransplantForm';


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
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'batchNumber', direction: 'desc' });

  const { toast } = useToast();

  // State for dialogs
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isLogActionOpen, setIsLogActionOpen] = useState(false);
  const [logActionMode, setLogActionMode] = useState<ActionMode>("MOVE");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isTransplantOpen, setIsTransplantOpen] = useState(false);

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
    if (!Array.isArray(locationsData) || !locationsData.length) return [];
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

  const getStatusVariant = (
    status: Batch['status']
  ): 'default' | 'secondary' | 'destructive' | 'outline' | 'accent' | 'info' => {
    switch (status) {
      case 'Incoming':
        return 'secondary';
      case 'Planned':
        return 'outline';
      case 'Ready for Sale':
      case 'Looking Good':
        return 'accent';
      case 'Propagation':
      case 'Plugs/Liners':
        return 'info';
      case 'Potted':
        return 'default';
      case 'Archived':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getLocationLabel = (batch: Batch) =>
    typeof batch.location === "string"
      ? batch.location
      : (batch as any)?.location?.name ??
        (batch as any)?.locationName ??
        "Unassigned";

  const getFamilyLabel = (batch: Batch) =>
    batch.plantFamily ||
    (batch as any)?.plant_family ||
    "Unspecified";

  const filteredBatches = useMemo(() => {
    const q = (searchQuery || '').trim();
    const filtered = batches
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
    
    // Apply sorting
    return [...filtered].sort((a, b) => {
      const { key, direction } = sortConfig;
      let aVal: any, bVal: any;
      
      switch (key) {
        case 'batchNumber':
          aVal = a.batchNumber || '';
          bVal = b.batchNumber || '';
          break;
        case 'variety':
          aVal = a.plantVariety || '';
          bVal = b.plantVariety || '';
          break;
        case 'family':
          aVal = a.plantFamily || '';
          bVal = b.plantFamily || '';
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'location':
          aVal = a.location || '';
          bVal = b.location || '';
          break;
        case 'quantity':
          aVal = a.quantity ?? 0;
          bVal = b.quantity ?? 0;
          break;
        default:
          aVal = a.batchNumber || '';
          bVal = b.batchNumber || '';
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const comparison = String(aVal).localeCompare(String(bVal));
      return direction === 'asc' ? comparison : -comparison;
    });
  }, [batches, searchQuery, filters, sortConfig]);
  
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

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

  const handleTransplantOpen = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsTransplantOpen(true);
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
     <PageFrame moduleKey="production">
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
                    <TransplantMenuButton />
                </>
            }
        />
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {filteredBatches.length} batch{filteredBatches.length !== 1 ? 'es' : ''}
            </span>
            {(filters.status !== 'all' || filters.plantFamily !== 'all' || filters.category !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setFilters({ plantFamily: 'all', status: 'all', category: 'all' })}
              >
                Clear filters
              </Button>
            )}
            {viewMode === "card" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
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
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "card" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="flex items-center gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Cards</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="flex items-center gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
          </div>
        </div>

        {viewMode === "card" ? (
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
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[140px] whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2 font-medium hover:bg-muted"
                        onClick={() => handleSort('batchNumber')}
                      >
                        Batch
                        {sortConfig.key === 'batchNumber' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="min-w-[180px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2 font-medium hover:bg-muted"
                        onClick={() => handleSort('variety')}
                      >
                        Variety
                        {sortConfig.key === 'variety' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="min-w-[160px]">
                      <div className="flex items-center gap-1">
                        <Select
                          value={filters.plantFamily}
                          onValueChange={(value) => setFilters((f) => ({ ...f, plantFamily: value }))}
                        >
                          <SelectTrigger className="h-8 border-0 bg-transparent shadow-none px-0 font-medium text-muted-foreground hover:text-foreground w-auto">
                            <SelectValue placeholder="Family" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Families</SelectItem>
                            {(plantFamilies || []).filter(p => p !== 'all').map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleSort('family')}
                        >
                          {sortConfig.key === 'family' ? (
                            sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[180px]">
                      <div className="flex items-center gap-1">
                        <Select
                          value={filters.status}
                          onValueChange={(value) => setFilters((f) => ({ ...f, status: value }))}
                        >
                          <SelectTrigger className="h-8 border-0 bg-transparent shadow-none px-0 font-medium text-muted-foreground hover:text-foreground w-auto">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {statuses.filter(s => s !== 'all').map(status => (
                              <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleSort('status')}
                        >
                          {sortConfig.key === 'status' ? (
                            sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[120px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2 font-medium hover:bg-muted"
                        onClick={() => handleSort('location')}
                      >
                        Location
                        {sortConfig.key === 'location' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right w-[90px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -mr-2 font-medium hover:bg-muted"
                        onClick={() => handleSort('quantity')}
                      >
                        Qty
                        {sortConfig.key === 'quantity' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right w-[110px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isDataLoading
                    ? [...Array(6)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={7} className="p-4">
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    : filteredBatches.map((batch) => (
                        <TableRow
                          key={batch.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewDetails(batch)}
                        >
                          <TableCell className="font-mono text-sm whitespace-nowrap">{batch.batchNumber}</TableCell>
                          <TableCell>
                            <div className="font-medium">{batch.plantVariety || "Unspecified"}</div>
                            <div className="text-xs text-muted-foreground">
                              {batch.size || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{getFamilyLabel(batch)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {batch.phase && (
                                <Badge variant="secondary" className="capitalize text-xs">
                                  {batch.phase}
                                </Badge>
                              )}
                              {batch.status && (
                                <Badge variant={getStatusVariant(batch.status)} className="text-xs">
                                  {batch.status}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{getLocationLabel(batch)}</TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium">
                              {(batch.quantity ?? 0).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              of {(batch.initialQuantity ?? batch.quantity ?? 0).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handlePrintClick(batch)}
                                      aria-label="Print label"
                                    >
                                      <Printer className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Print Label</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <ActionMenuButton
                                batch={batch}
                                onSelect={(mode) => handleLogAction(batch, mode)}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                label=""
                              />
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="default"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleTransplantOpen(batch)}
                                      aria-label="Transplant"
                                    >
                                      <TransplantIcon className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Transplant</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        )}
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
        onTransplant={handleTransplantOpen}
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
      
      {/* Transplant Dialog */}
      <Dialog open={isTransplantOpen} onOpenChange={setIsTransplantOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transplant from {selectedBatch?.batchNumber}</DialogTitle>
            <DialogDescription>
              {selectedBatch?.plantVariety ? `${selectedBatch.plantVariety}` : "Create a new batch from this parent."}
              {typeof selectedBatch?.quantity === "number" ? ` • ${selectedBatch.quantity.toLocaleString()} units remaining` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedBatch && (
            <TransplantForm
              parentBatchId={selectedBatch.id!}
              onCreated={() => {
                setIsTransplantOpen(false);
                mutateBatches();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PageFrame>
  );
}
