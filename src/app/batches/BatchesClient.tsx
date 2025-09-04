
'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from 'swr';

import {
  Search,
  Filter,
} from 'lucide-react';
import type { Batch } from '@/lib/types';
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

import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { queryMatchesBatch } from '@/lib/search';
import { getBatchesAction } from '@/app/actions';
import { BatchCard } from '@/components/batch-card';
import { Grid } from 'lucide-react';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';


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

  const handleViewDetails = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsDetailDialogOpen(true);
  };
  
  const handleEditBatch = (batch: Batch) => {
    // Logic to open an edit form/dialog
    console.log("Editing batch:", batch);
    // You would typically set state to open a dialog here, e.g.:
    // setEditingBatch(batch);
    // setIsFormOpen(true);
  };
  
  const TABS = [
    { label: "Production", href: "/", exact: true },
    { label: "Batches", href: "/batches" },
    { label: "Sales", href: "/sales" },
    { label: "Actions", href: "/actions" },
];

  if (isDataLoading && !batches.length) {
     return (
        <div className="flex min-h-screen w-full flex-col p-6 items-center justify-center">
            <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
    );
  }

  return (
     <PageFrame companyName="Doran Nurseries" moduleKey="production" moduleTabs={TABS}>
      <div className="space-y-6">
        <ModulePageHeader 
            title="All Batches"
            description="View, search, and manage all batch records."
            actionsSlot={
                <>
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
                </>
            }
        />
        
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex gap-2">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="shrink-0 w-full sm:w-auto">
                            <Filter className="mr-2" />
                            Filter by Status
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
                        </DropdownMenuContent>
                        </DropdownMenu>

                         <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="shrink-0 w-full sm:w-auto">
                            <Filter className="mr-2" />
                            Filter by Category
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={filters.category} onValueChange={(value) => setFilters(f => ({ ...f, category: value }))}>
                            {categories.map(cat => (
                                <DropdownMenuRadioItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</DropdownMenuRadioItem>
                            ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                        </DropdownMenu>
                        
                         <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="shrink-0 w-full sm:w-auto">
                            <Filter className="mr-2" />
                            Filter by Family
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
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
                    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
                        {[...Array(9)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
                      {filteredBatches.map((batch) => (
                          <BatchCard
                            key={batch.id}
                            batch={batch}
                            onOpen={handleViewDetails}
                          />
                      ))}
                    </div>
                )}
                 {filteredBatches.length === 0 && !isDataLoading && (
                    <div className="flex h-[20vh] flex-col items-center justify-center rounded-lg text-center">
                         <Grid className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">No Batches Found</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Try adjusting your search or filters.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>

      <BatchDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        batch={selectedBatch}
        onEdit={handleEditBatch}
        onTransplant={() => {}}
        onLogAction={() => {}}
        onGenerateProtocol={() => {}}
        onCareRecommendations={() => {}}
      />
    </div>
    </PageFrame>
  );
}
