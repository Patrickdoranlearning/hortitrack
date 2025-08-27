
'use client';

import * as React from 'react';
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from 'swr';

import {
  Search,
  Filter,
  ArrowLeft,
  Download,
  Upload,
} from 'lucide-react';
import type { Batch } from '@/lib/types';
import type { NurseryLocation, PlantSize } from "@/lib/types";
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
import { BatchDetailDialog } from "@/components/batch-detail-dialog";
import { TransplantForm, TransplantFormData } from "@/components/transplant-form";
import MobileBatchCard from "@/components/mobile-batch-card";

import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { BatchForm } from "@/components/batch-form";
import { queryMatchesBatch } from '@/lib/search';
import { fetchJson } from "@/lib/http";
import { getBatchesAction } from '@/app/actions'; // Import Supabase action
import { searchLocations, searchSizes } from '@/server/refdata/queries'; // Import Supabase search functions

// Removed Firebase-specific helpers (toMillis, batchDateScore, tsToIso, normalizeBatch)

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for dialogs
  const [isTransplantDialogOpen, setIsTransplantDialogOpen] = useState(false);
  const [batchToTransplant, setBatchToTransplant] = useState<Batch | null>(null);
  const [isBatchDetailDialogOpen, setIsBatchDetailDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [batchToEdit, setBatchToEdit] = useState<Batch | null>(null);

  // UseSWR for fetching batches from Supabase, with initialData from SSR
  const { data: batchesResult, error: batchesError, isLoading: isDataLoading, mutate: revalidateBatches } = useSWR(
    'batches', 
    getBatchesAction, 
    { fallbackData: { success: true, data: initialBatches } }
  );
  const batches = batchesResult?.data || [];

  // UseSWR for fetching locations
  const { data: locationsResult, error: locationsError } = useSWR('locations', () => searchLocations(''));
  const nurseryLocations = locationsResult || [];

  // UseSWR for fetching sizes
  const { data: sizesResult, error: sizesError } = useSWR('sizes', () => searchSizes(''));
  const plantSizes = sizesResult || [];

  if (batchesError) console.error("Error fetching batches:", batchesError);
  if (locationsError) console.error("Error fetching locations:", locationsError);
  if (sizesError) console.error("Error fetching sizes:", sizesError);


  // Open dialog if ?batch=<id> present
  useEffect(() => {
    if (!urlBatch || !batches?.length) return;
    const b = batches.find(x => x.id === urlBatch || x.batchNumber === urlBatch);
    if (b) {
      setSelectedBatch(b);
      setIsBatchDetailDialogOpen(true);
    }
  }, [urlBatch, batches]);


  const plantFamilies = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.plantFamily).filter(Boolean)))], [batches]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.category).filter(Boolean)))], [batches]);
  const statuses = useMemo(() => ['all', 'Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived'], []);

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


  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (typeof date === 'string') {
      try {
        return format(new Date(date), 'PPP');
      } catch {
        return "Invalid Date";
      }
    }
    return 'Invalid Date';
  };

  const getStatusVariant = (status: Batch['status']): "default" | "secondary" | "destructive" | "outline" | "accent" | "info" => {
    switch (status) {
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

  const handleTransplant = (batch: Batch) => {
    setBatchToTransplant(batch);
    setIsTransplantDialogOpen(true);
  };

  const handleViewDetails = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsBatchDetailDialogOpen(true);
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key !== "Enter") return;
    const hit = filteredBatches.length > 0 ? filteredBatches[0] : undefined;
    if (hit) {
      e.preventDefault();
      handleViewDetails(hit);
    } else {
      toast({
        variant: "outline",
        title: "No matching batch",
        description: `Couldn't find batch matching "${searchQuery}".`,
      });
    }
  };

  const handleEditBatch = (batch: Batch) => {
    setBatchToEdit(batch);
    setIsBatchDetailDialogOpen(false); 
    setIsEditDialogOpen(true); 
  };

  const handleDeleteBatch = async (batch: Batch) => {
    if (!confirm(`Delete batch #${batch.batchNumber}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/batches/${batch.id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        let msg = "Delete failed";
        try {
          const j = JSON.parse(txt);
          msg = j?.error || msg;
        } catch {
          if (txt) msg = txt;
        }
        throw new Error(msg);
      }
      toast({ title: "Deleted", description: `Batch #${batch.batchNumber} removed.` });
      setIsBatchDetailDialogOpen(false);
      setSelectedBatch(null);
      revalidateBatches(); // Revalidate SWR cache
    } catch (e: any) {
      console.error("Delete API error:", e);
      toast({ variant: "destructive", title: "Delete failed", description: e.message });
    }
  };

  const handleTransplantSubmit = async (data: TransplantFormData) => {
    if (!batchToTransplant) return;
    try {
      await fetchJson(`/api/batches/${batchToTransplant.id}/transplant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      toast({
        title: "Transplant Successful",
        description: `Created new batch from #${batchToTransplant.batchNumber}`,
      });
      setIsTransplantDialogOpen(false);
      setBatchToTransplant(null);
      revalidateBatches(); // Revalidate SWR cache
    } catch (error: any) {
      console.error("Transplant API error:", error);
      toast({ variant: "destructive", title: "Transplant Failed", description: error.message });
    }
  };
  
  // Handlers for CSV are complex and depend on external state, keeping for now but might need adjustment
  
  const handleTransplantCancel = () => {
    setIsTransplantDialogOpen(false);
    setBatchToTransplant(null);
  };

  const handleEditCancel = () => {
    setIsEditDialogOpen(false);
    setBatchToEdit(null);
  };

  if (isDataLoading && !batches.length) {
     return (
        <div className="flex min-h-screen w-full flex-col p-6 items-center justify-center">
            <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-3 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
                <h1 className="mb-1 font-headline text-2xl sm:text-4xl truncate">Manage Batch Data</h1>
                <p className="text-muted-foreground">View, search, and manage all batch records.</p>
            </div>
            <Button asChild variant="outline">
                <Link href="/settings">
                    <ArrowLeft />
                    Back to Data Management
                </Link>
            </Button>
        </div>

        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>All Batches</CardTitle>
                        <CardDescription>A complete history of all batches recorded in the system.</CardDescription>
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between pt-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by number, category, family, variety..."
                          className="pl-10 w-full"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                        />
                    </div>
                    <div className="flex gap-2">
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
            </CardHeader>
            <CardContent>
                {isDataLoading ? (
                    <div className="space-y-2">
                        {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto">
                      <Table>
                          <TableHeader>
                          <TableRow>
                              <TableHead>Batch #</TableHead>
                              <TableHead>Variety</TableHead>
                              <TableHead>Family</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead className="text-right">Current Qty</TableHead>
                              <TableHead className="text-right">Initial Qty</TableHead>
                              <TableHead>Created</TableHead>
                          </TableRow>
                          </TableHeader>
                          <TableBody>
                          {filteredBatches.map((batch) => (
                              <TableRow key={batch.id} onClick={() => handleViewDetails(batch)} className="cursor-pointer">
                                  <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                                  <TableCell>{batch.plantVariety}</TableCell>
                                  <TableCell>{batch.plantFamily}</TableCell>
                                  <TableCell>
                                      <Badge variant={getStatusVariant(batch.status)}>{batch.status}</Badge>
                                  </TableCell>
                                  <TableCell>{batch.location}</TableCell>
                                  <TableCell>{batch.size}</TableCell>
                                  <TableCell className="text-right font-semibold">{batch.quantity?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{batch.initialQuantity?.toLocaleString()}</TableCell>
                                  <TableCell>{formatDate(batch.createdAt)}</TableCell>
                              </TableRow>
                          ))}
                          </TableBody>
                      </Table>
                    </div>
                )}
                 {filteredBatches.length === 0 && !isDataLoading && (
                    <div className="flex h-[20vh] flex-col items-center justify-center rounded-lg text-center">
                        <p className="text-lg font-medium text-muted-foreground">
                        No batches found.
                        </p>
                        <p className="text-sm text-muted-foreground">
                        Try adjusting your search or filters.
                        </p>
                    </div>
                )}
            </CardContent>
             <CardContent className="md:hidden">
                <div className="space-y-3">
                  {filteredBatches.map((b) => (
                    <MobileBatchCard
                      key={b.id}
                      batch={b}
                      onView={handleViewDetails}
                      onEdit={handleEditBatch}
                      onDelete={handleDeleteBatch}
                      onTransplant={handleTransplant}
                    />
                  ))}
                  {filteredBatches.length === 0 && !isDataLoading && (
                    <div className="flex h-[20vh] flex-col items-center justify-center rounded-lg text-center">
                      <p className="text-lg font-medium text-muted-foreground">No batches found.</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
                    </div>
                  )}
                </div>
              </CardContent>
        </Card>

      <BatchDetailDialog
        open={isBatchDetailDialogOpen}
        onOpenChange={setIsBatchDetailDialogOpen}
        batch={selectedBatch}
        onEdit={handleEditBatch}
        onTransplant={handleTransplant}
        onLogAction={() => {}}
        onGenerateProtocol={() => {}}
        onDelete={handleDeleteBatch}
        onCareRecommendations={() => {}}
      />

      <Dialog open={isTransplantDialogOpen} onOpenChange={setIsTransplantDialogOpen}>
        {batchToTransplant && (
          <TransplantForm
            batch={batchToTransplant}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
            onSubmit={handleTransplantSubmit}
            onCancel={handleTransplantCancel}
          />
        )}
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        {batchToEdit && (
          <BatchForm
            batch={batchToEdit}
            onSubmitSuccess={async () => {
              setIsEditDialogOpen(false);
              setBatchToEdit(null);
              revalidateBatches();
              toast({ title: "Saved", description: `Batch #${batchToEdit.batchNumber} updated.` });
            }}
            onCancel={handleEditCancel}
            onArchive={() => {}} 
            onCreateNewVariety={() => {}}
          />
        )}
      </Dialog>
    </div>
  );
}
