"use client";

import React, { useState, useMemo } from 'react';
import { Batch, NurseryLocation, PlantSize, Supplier, Variety, TransplantFormData, LogEntry, ActionLogFormValues } from "@/lib/types";
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
import type { ActionResult } from './actions';

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
  nurseryLocations: NurseryLocation[];
  plantSizes: PlantSize[];
  suppliers: Supplier[];
  varieties: Variety[];
  actions: {
    addBatch: (data: any) => Promise<ActionResult<any>>;
    updateBatch: (data: any) => Promise<ActionResult<any>>;
    archiveBatch: (batchId: string, loss: number) => Promise<ActionResult<any>>;
    transplantBatch: (sourceBatchId: string, newBatchData: any, transplantQuantity: number, logRemainingAsLoss: boolean) => Promise<ActionResult<any>>;
    logAction: (batchId: string, logData: any) => Promise<ActionResult<any>>;
    addVariety: (data: any) => Promise<ActionResult<any>>;
  }
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
  nurseryLocations,
  plantSizes,
  suppliers,
  varieties,
  actions,
}: HomePageViewProps) {
  const { toast } = useToast();

  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchDistribution, setBatchDistribution] = useState<BatchDistribution | null>(null);
  const [transplantingBatch, setTransplantingBatch] = useState<Batch | null>(null);
  const [actionLogBatch, setActionLogBatch] = useState<Batch | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTransplantFormOpen, setIsTransplantFormOpen] = useState(false);
  const [isActionLogFormOpen, setIsActionLogFormOpen] = useState(false);
  const [isProtocolDialogOpen, setIsProtocolDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScannedActionsOpen, setIsScannedActionsOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [scannedBatch, setScannedBatch] = useState<Batch | null>(null);
  const [protocolBatch, setProtocolBatch] = useState<Batch | null>(null);
  const [isVarietyFormOpen, setIsVarietyFormOpen] = useState(false);
  const [newVarietyName, setNewVarietyName] = useState('');

  const handleNewBatch = () => {
    setEditingBatch(null);
    setBatchDistribution(null);
    setIsFormOpen(true);
  };

  const handleEditBatch = (batch: Batch) => {
    const transplantedQuantity = batch.logHistory
      .filter(log => log.type === 'TRANSPLANT_TO' && typeof log.qty === 'number')
      .reduce((sum, log) => sum - log.qty!, 0);
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
  };

  const handleArchiveBatch = async (batchId: string) => {
    const batchToArchive = batches.find((b) => b.id === batchId);
    if (!batchToArchive) return;
  
    const loss = batchToArchive.quantity;
    const result = await actions.archiveBatch(batchId, loss);
  
    if (result.success) {
      toast({ title: 'Success', description: `Batch #${batchToArchive.batchNumber} has been archived.` });
    } else {
      toast({ variant: 'destructive', title: 'Error archiving batch', description: result.error });
    }
  };

  const handleFormSubmit = async (data: Omit<Batch, 'id' | 'batchNumber' | 'createdAt' | 'updatedAt'> & { id?: string; batchNumber?: string }) => {
    if (editingBatch) {
      const result = await actions.updateBatch(data as Batch);
      if (result.success) {
        toast({ title: 'Batch Updated', description: `Batch #${result.data?.batchNumber} saved.` });
      } else {
        toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
      }
    } else {
      const newBatchData = { ...data, supplier: data.supplier || 'Doran Nurseries', initialQuantity: data.quantity };
      const result = await actions.addBatch(newBatchData);
      if (result.success) {
        toast({ title: 'Batch Created', description: `Batch #${result.data?.batchNumber} added.` });
      } else {
        toast({ variant: 'destructive', title: 'Create Failed', description: String(result.error ?? 'Unknown error') });
      }
    }
    setEditingBatch(null);
    setBatchDistribution(null);
    setIsFormOpen(false);
  };

  const handleTransplantBatch = (batch: Batch) => {
    setTransplantingBatch(batch);
    setIsTransplantFormOpen(true);
  };

  const onTransplantFormSubmit = async (values: any) => {
    if (!transplantingBatch) return;

    try {
      const transplantQuantity = Number(values?.quantity ?? 0);
      if (!transplantQuantity || transplantQuantity <= 0) {
        toast({ variant: "destructive", title: "Transplant quantity required" });
        return;
      }
  
      const newBatchData: Omit<Batch, "id" | "logHistory" | "transplantedFrom" | "batchNumber" | "createdAt" | "updatedAt"> = {
        plantVariety: transplantingBatch.plantVariety,
        plantFamily: transplantingBatch.plantFamily,
        category: transplantingBatch.category,
        size: values.size || transplantingBatch.size,
        location: values.location || transplantingBatch.location,
        supplier: values.supplier || transplantingBatch.supplier,
        status: (values.status as Batch["status"]) || transplantingBatch.status,
        plantingDate: transplantingBatch.plantingDate,
        growerPhotoUrl: transplantingBatch.growerPhotoUrl ?? "",
        salesPhotoUrl: transplantingBatch.salesPhotoUrl ?? "",
        initialQuantity: transplantQuantity,
        quantity: transplantQuantity,
      };
  
      const logRemainingAsLoss = Boolean(values?.logRemainingAsLoss);
      const result = await actions.transplantBatch(transplantingBatch.id, newBatchData, transplantQuantity, logRemainingAsLoss);
      
      if (result.success) {
        toast({ title: 'Transplant Successful', description: `New batch #${result.data?.newBatch.batchNumber} created.` });
      } else {
        toast({ variant: 'destructive', title: 'Transplant Failed', description: result.error });
      }
      setTransplantingBatch(null);
      setIsTransplantFormOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Transplant crashed", description: String(e?.message ?? e) });
    }
  };

  const handleLogAction = (batch: Batch) => {
    setActionLogBatch(batch);
    setIsActionLogFormOpen(true);
  };

  const onActionLogFormSubmit = async (values: ActionLogFormValues) => {
    if (!actionLogBatch) return;
    try {
      const result = await actions.logAction(actionLogBatch.id, values);
      if (result.success) {
        toast({ title: 'Action Logged', description: 'The action has been successfully logged.' });
      } else {
        toast({ variant: 'destructive', title: 'Logging Failed', description: result.error });
      }
      setActionLogBatch(null);
      setIsActionLogFormOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Logging crashed", description: String(e?.message ?? e) });
    }
  };

  const onCreateNewVariety = (name: string) => {
    setNewVarietyName(name);
    setIsVarietyFormOpen(true);
  };

  const onVarietyFormSubmit = async (data: Omit<Variety, 'id'>) => {
    const result = await actions.addVariety(data);
    if (result.success) {
      toast({ title: 'Variety Created', description: `Successfully created "${result.data?.name}".` });
      setIsVarietyFormOpen(false);
      setNewVarietyName('');
    } else {
      toast({ variant: 'destructive', title: 'Creation Failed', description: result.error });
    }
  };

  const statuses = ["Active", "all", "Propagation", "Plugs/Liners", "Potted", "Ready for Sale", "Looking Good", "Archived"];

  const handleCardClick = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsDetailDialogOpen(true);
  };

  const handleScanSuccess = (scannedData: string) => {
    const trimmedScan = scannedData.trim().toLowerCase();
    const foundBatch = batches.find(b => b.batchNumber.trim().toLowerCase() === trimmedScan);
    if (foundBatch) {
      setScannedBatch(foundBatch);
      setIsScannedActionsOpen(true);
    } else {
      toast({ variant: 'destructive', title: 'Batch not found', description: `No batch found with code: ${scannedData}` });
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
              <Link href="/dashboard"><LayoutDashboard /> Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings"><Database /> Manage Data</Link>
            </Button>
            <Button onClick={handleNewBatch} size="lg"><PlusCircle /> New Batch</Button>
            <Button onClick={onSignOut} variant="ghost" size="icon"><LogOut /><span className="sr-only">Sign Out</span></Button>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <Button onClick={() => setIsScannerOpen(true)} size="icon" variant="outline"><ScanLine /><span className="sr-only">Scan</span></Button>
             <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon"><Menu /><span className="sr-only">Open menu</span></Button>
                </SheetTrigger>
                <SheetContent>
                    <div className="flex flex-col gap-4">
                        <SheetClose asChild><Button onClick={handleNewBatch} className="w-full"><PlusCircle /> New Batch</Button></SheetClose>
                        <SheetClose asChild><Button asChild variant="outline" className="w-full"><Link href="/dashboard"><LayoutDashboard /> Dashboard</Link></Button></SheetClose>
                        <SheetClose asChild><Button asChild variant="outline" className="w-full"><Link href="/settings"><Database /> Manage Data</Link></Button></SheetClose>
                        <SheetClose asChild><Button onClick={onSignOut} variant="ghost" className="w-full"><LogOut /> Sign Out</Button></SheetClose>
                    </div>
                </SheetContent>
            </Sheet>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by category, family, variety..." className="pl-10 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex gap-2">
             <Button onClick={() => setIsScannerOpen(true)} className="hidden sm:inline-flex"><ScanLine /> Scan Code</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shrink-0 w-full sm:w-auto"><Filter className="mr-2" /> Filter</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={filters.status} onValueChange={(value) => setFilters((f) => ({ ...f, status: value }))}>
                  {statuses.map((status) => (<DropdownMenuRadioItem key={status} value={status}>{status === 'all' ? 'All Statuses' : status}</DropdownMenuRadioItem>))}
                </DropdownMenuRadioGroup>

                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={filters.category} onValueChange={(value) => setFilters((f) => ({ ...f, category: value }))}>
                  {categories.map((cat) => (<DropdownMenuRadioItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</DropdownMenuRadioItem>))}
                </DropdownMenuRadioGroup>
                
                <DropdownMenuLabel>Filter by Plant Family</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={filters.plantFamily} onValueChange={(value) => setFilters((f) => ({ ...f, plantFamily: value }))}>
                  {plantFamilies.map((fam) => (<DropdownMenuRadioItem key={fam} value={fam}>{fam === 'all' ? 'All Families' : fam}</DropdownMenuRadioItem>))}
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
              <BatchCard key={batch.id} batch={batch} onClick={handleCardClick} onLogAction={() => handleLogAction(batch)} onTransplant={() => handleTransplantBatch(batch)} />
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
            <DialogDescription>{editingBatch ? "Update the details for this batch." : "Enter the details for the new batch."}</DialogDescription>
          </DialogHeader>
          <BatchForm batch={editingBatch} distribution={batchDistribution} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} onArchive={handleArchiveBatch} nurseryLocations={nurseryLocations} plantSizes={plantSizes} suppliers={suppliers} varieties={varieties} onCreateNewVariety={onCreateNewVariety} />
        </DialogContent>
      </Dialog>
      
      <Dialog open={isVarietyFormOpen} onOpenChange={setIsVarietyFormOpen}>
        <DialogContent className="max-w-2xl">
            <VarietyForm variety={{ name: newVarietyName, family: '', category: '' }} onSubmit={onVarietyFormSubmit} onCancel={() => setIsVarietyFormOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isTransplantFormOpen} onOpenChange={setIsTransplantFormOpen}>
        <DialogContent className="max-w-2xl">
          <TransplantForm batch={transplantingBatch} onSubmit={onTransplantFormSubmit} onCancel={() => setIsTransplantFormOpen(false)} nurseryLocations={nurseryLocations} plantSizes={plantSizes} />
        </DialogContent>
      </Dialog>

      <Dialog open={isActionLogFormOpen} onOpenChange={setIsActionLogFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Action</DialogTitle>
            <DialogDescription>Add a note, move, or loss entry to the batch history.</DialogDescription>
          </DialogHeader>
          <ActionLogForm batch={actionLogBatch} onSubmit={onActionLogFormSubmit} onCancel={() => setIsActionLogFormOpen(false)} nurseryLocations={nurseryLocations} />
        </DialogContent>
      </Dialog>

      <ProductionProtocolDialog open={isProtocolDialogOpen} onOpenChange={setIsProtocolDialogOpen} batch={protocolBatch} />
      <ScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={handleScanSuccess} />
      <ScannedBatchActionsDialog open={isScannedActionsOpen} onOpenChange={setIsScannedActionsOpen} batch={scannedBatch}
        onLogAction={() => { setIsScannedActionsOpen(false); if (scannedBatch) handleLogAction(scannedBatch); }}
        onTransplant={() => { setIsScannedActionsOpen(false); if (scannedBatch) handleTransplantBatch(scannedBatch); }}
        onEdit={() => { setIsScannedActionsOpen(false); if (scannedBatch) handleEditBatch(scannedBatch); }}
        onGenerateProtocol={() => { setIsScannedActionsOpen(false); if (scannedBatch) setProtocolBatch(scannedBatch); setIsProtocolDialogOpen(true); }}
      />
      <BatchDetailDialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen} batch={selectedBatch}
        onEdit={handleEditBatch}
        onTransplant={handleTransplantBatch}
        onLogAction={handleLogAction}
        onGenerateProtocol={(batch) => { setProtocolBatch(batch); setIsDetailDialogOpen(false); setIsProtocolDialogOpen(true); }}
      />
    </div>
  );
}
