
"use client";

import React, { useState } from 'react';
import { Batch, NurseryLocation, PlantSize, Supplier, Variety, TransplantFormData, LogEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, LayoutDashboard, Database, PlusCircle, LogOut, ScanLine, Menu, Search } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchCard } from "@/components/batch-card";
import { BatchForm, BatchDistribution } from "@/components/batch-form";
import { VarietyForm } from '@/components/variety-form';
import { TransplantForm } from "@/components/transplant-form";
import { ActionLogForm } from "@/components/action-log-form";
import { ProductionProtocolDialog } from "@/components/production-protocol-dialog";
import { ScannerDialog } from "@/components/scanner-dialog";
import { ScannedBatchActionsDialog } from "@/components/scanned-batch-actions-dialog";
import { BatchDetailDialog } from "@/components/batch-detail-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Logo } from '@/components/logo';
import type { User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';


interface HomePageViewProps {
  isDataLoading: boolean;
  authLoading: boolean;
  user: User | null;
  batches: Batch[];
  plantFamilies: string[];
  categories: string[];
  filters: { plantFamily: string; category: string; status: string };
  setFilters: React.Dispatch<React.SetStateAction<{ plantFamily: string; category: string; status: string }>>;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onSignOut: () => void;
  onNewBatch: () => void;
  onEditBatch: (batch: Batch) => void;
  onArchiveBatch: (batchId: string) => void;
  onTransplantBatch: (batch: Batch) => void;
  onLogAction: (batch: Batch) => void;
  onFormSubmit: (data: any) => void;
  onTransplantFormSubmit: (data: TransplantFormData) => void;
  onActionLogFormSubmit: (data: any) => void;
  editingBatch: Batch | null;
  setEditingBatch: (batch: Batch | null) => void;
  batchDistribution: BatchDistribution | null;
  transplantingBatch: Batch | null;
  setTransplantingBatch: (batch: Batch | null) => void;
  actionLogBatch: Batch | null;
  setActionLogBatch: (batch: Batch | null) => void;
  nurseryLocations: NurseryLocation[];
  plantSizes: PlantSize[];
  suppliers: Supplier[];
  varieties: Variety[];
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  isTransplantFormOpen: boolean;
  setIsTransplantFormOpen: (open: boolean) => void;
  isActionLogFormOpen: boolean;
  setIsActionLogFormOpen: (open: boolean) => void;
  isVarietyFormOpen: boolean;
  setIsVarietyFormOpen: (open: boolean) => void;
  newVarietyName: string;
  onCreateNewVariety: (name: string) => void;
  onVarietyFormSubmit: (data: Omit<Variety, 'id'>) => void;
}

export default function HomePageView({
  isDataLoading,
  authLoading,
  user,
  batches,
  plantFamilies,
  categories,
  filters,
  setFilters,
  searchQuery,
  setSearchQuery,
  onSignOut,
  onNewBatch,
  onEditBatch,
  onArchiveBatch,
  onTransplantBatch,
  onLogAction,
  onFormSubmit,
  onTransplantFormSubmit,
  onActionLogFormSubmit,
  editingBatch,
  setEditingBatch,
  batchDistribution,
  transplantingBatch,
  setTransplantingBatch,
  actionLogBatch,
  setActionLogBatch,
  nurseryLocations,
  plantSizes,
  suppliers,
  varieties,
  isFormOpen,
  setIsFormOpen,
  isTransplantFormOpen,
  setIsTransplantFormOpen,
  isActionLogFormOpen,
  setIsActionLogFormOpen,
  isVarietyFormOpen,
  setIsVarietyFormOpen,
  newVarietyName,
  onCreateNewVariety,
  onVarietyFormSubmit,
}: HomePageViewProps) {
  const { toast } = useToast();
  // Local state for dialogs
  const [isProtocolDialogOpen, setIsProtocolDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScannedActionsOpen, setIsScannedActionsOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [scannedBatch, setScannedBatch] = useState<Batch | null>(null);
  const [protocolBatch, setProtocolBatch] = useState<Batch | null>(null);

  const statuses = ["Active", "all", "Propagation", "Plugs/Liners", "Potted", "Ready for Sale", "Looking Good", "Archived"];

  const handleCardClick = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsDetailDialogOpen(true);
  };
  
  const openEditDialog = (batch: Batch) => {
      onEditBatch(batch);
      setIsDetailDialogOpen(false);
  };

  const openTransplantDialog = (batch: Batch) => {
      onTransplantBatch(batch);
      setIsDetailDialogOpen(false);
  };

  const openLogActionDialog = (batch: Batch) => {
      onLogAction(batch);
      setIsDetailDialogOpen(false);
  };

  const openProtocolDialog = (batch: Batch) => {
      setProtocolBatch(batch);
      setIsDetailDialogOpen(false);
      setIsProtocolDialogOpen(true);
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
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <LayoutDashboard /> Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings">
                <Database /> Manage Data
              </Link>
            </Button>
            <Button
              onClick={onNewBatch}
              size="lg"
            >
              <PlusCircle /> New Batch
            </Button>
            <Button onClick={onSignOut} variant="ghost" size="icon">
              <LogOut />
              <span className="sr-only">Sign Out</span>
            </Button>
          </div>
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
                            <Button onClick={onNewBatch} className="w-full">
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
                            <Button onClick={onSignOut} variant="ghost" className="w-full">
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
                <DropdownMenuRadioGroup value={filters.status} onValueChange={(value) => setFilters((f) => ({ ...f, status: value }))}>
                  {statuses.map((status) => (
                    <DropdownMenuRadioItem key={status} value={status}>{status === 'all' ? 'All Statuses' : status}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={filters.category} onValueChange={(value) => setFilters((f) => ({ ...f, category: value }))}>
                  {categories.map((cat) => (
                    <DropdownMenuRadioItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                
                <DropdownMenuLabel>Filter by Plant Family</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={filters.plantFamily} onValueChange={(value) => setFilters((f) => ({ ...f, plantFamily: value }))}>
                  {plantFamilies.map((fam) => (
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
        ) : batches.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {batches.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                onClick={handleCardClick}
                onLogAction={() => openLogActionDialog(batch)}
                onTransplant={() => openTransplantDialog(batch)}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/50">
            <p className="text-lg font-medium text-muted-foreground">No batches found.</p>
            <p className="text-sm text-muted-foreground">Try adjusting filters or create a new batch.</p>
          </div>
        )}
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingBatch ? `Edit Batch #${editingBatch?.batchNumber}` : "Create New Batch"}</DialogTitle>
            <DialogDescription>
              {editingBatch ? "Update the details for this batch." : "Enter the details for the new batch."}
            </DialogDescription>
          </DialogHeader>
          <BatchForm
            batch={editingBatch}
            distribution={batchDistribution}
            onSubmit={onFormSubmit}
            onCancel={() => setIsFormOpen(false)}
            onArchive={onArchiveBatch}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
            suppliers={suppliers}
            varieties={varieties}
            onCreateNewVariety={onCreateNewVariety}
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={isVarietyFormOpen} onOpenChange={setIsVarietyFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Variety</DialogTitle>
            <DialogDescription>Create a new plant variety to reuse later.</DialogDescription>
          </DialogHeader>
            <VarietyForm
                variety={{ name: newVarietyName, family: '', category: '' }}
                onSubmit={onVarietyFormSubmit}
                onCancel={() => setIsVarietyFormOpen(false)}
            />
        </DialogContent>
      </Dialog>

      <Dialog open={isTransplantFormOpen} onOpenChange={setIsTransplantFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transplant Batch</DialogTitle>
            <DialogDescription>Move quantity into a new batch and optionally log remaining as loss.</DialogDescription>
          </DialogHeader>
          <TransplantForm
            batch={transplantingBatch}
            onSubmit={onTransplantFormSubmit}
            onCancel={() => setIsTransplantFormOpen(false)}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isActionLogFormOpen} onOpenChange={setIsActionLogFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Action</DialogTitle>
            <DialogDescription>Add a note, move, or loss entry to the batch history.</DialogDescription>
          </DialogHeader>
          <ActionLogForm
            batch={actionLogBatch}
            onSubmit={onActionLogFormSubmit}
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
          if (scannedBatch) openLogActionDialog(scannedBatch);
        }}
        onTransplant={() => {
          setIsScannedActionsOpen(false);
          if (scannedBatch) openTransplantDialog(scannedBatch);
        }}
        onEdit={() => {
          setIsScannedActionsOpen(false);
          if (scannedBatch) openEditDialog(scannedBatch);
        }}
        onGenerateProtocol={() => {
          setIsScannedActionsOpen(false);
          if (scannedBatch) openProtocolDialog(scannedBatch);
        }}
      />

      <BatchDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        batch={selectedBatch}
        onEdit={openEditDialog}
        onTransplant={openTransplantDialog}
        onLogAction={openLogActionDialog}
        onGenerateProtocol={openProtocolDialog}
      />
    </div>
  );
}
