

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
  List,
  LogOut,
  Plus,
  QrCode,
  Search,
  Sparkles,
  Users,
  Printer,
  MoreHorizontal,
  ShoppingCart,
  ClipboardList,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { ActionDialog } from '../components/actions/ActionDialog';
import { ActionMenuButton } from '../components/actions/ActionMenuButton';
import type { ActionMode } from "@/components/actions/types";
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
import { TransplantMenuButton } from "@/components/horti/TransplantMenuButton";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckInWizardDialog } from '@/components/production/checkin';
import { PlanIncomingWizardDialog } from '@/components/production/plan-incoming';
import { PlanBatchesWizardDialog } from '@/components/production/plan-batches';
import { ActualizeWizardDialog } from '@/components/production/actualize';
import { useCollection } from '@/hooks/useCollection'; 
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { useActiveOrg } from '@/lib/org/context';
import { supabaseClient } from '@/lib/supabase/client'; 
import EditBatchForm from '@/components/batches/EditBatchForm';
import { ReferenceDataProvider } from '@/contexts/ReferenceDataContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PropagationForm = dynamic(() => import('@/components/batches/PropagationForm'), { ssr: false });
const BulkPropagationUpload = dynamic(() => import('@/components/batches/BulkPropagationUpload'), { ssr: false });
const VarietyForm = dynamic(() => import('@/components/varieties/VarietyForm'), { ssr: false });
const TransplantForm = dynamic(() => import('@/components/batches/TransplantForm'), { ssr: false });

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
  const [logActionMode, setLogActionMode] = React.useState<ActionMode>("MOVE");
  const [isTransplantOpen, setIsTransplantOpen] = React.useState(false);
  const [isProtocolOpen, setIsProtocolOpen] = React.useState(false);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = React.useState(false);
  const [isVarietyFormOpen, setIsVarietyFormOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isNewPropagationOpen, setIsNewPropagationOpen] = React.useState(false);
  const [isCheckinFormOpen, setIsCheckinFormOpen] = React.useState(false);
  const [isPlanIncomingOpen, setIsPlanIncomingOpen] = React.useState(false);
  const [isPlanBatchesOpen, setIsPlanBatchesOpen] = React.useState(false);
  const [isActualizeOpen, setIsActualizeOpen] = React.useState(false);

  const [selectedBatch, setSelectedBatch] = React.useState<Batch | null>(null);
  const [editingBatch, setEditingBatch] = React.useState<Batch | null>(null);
  const [newVarietyName, setNewVarietyName] = React.useState('');
  
  const [filters, setFilters] = React.useState({
    plantFamily: 'all',
    category: 'all',
    status: 'Active',
    variety: 'all',
    location: 'all',
  });
  const [viewMode, setViewMode] = React.useState<"card" | "list">("card");
  const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'batchNumber', direction: 'desc' });
  
  const clearBatchQuery = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("batch")) return;
    params.delete("batch");
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/");
  }, [router, searchParams]);

  const [searchQuery, setSearchQuery] = React.useState('');

  const varietyOptions = React.useMemo(() => {
    const set = new Set<string>();
    (batches || []).forEach((batch) => {
      if (batch.plantVariety) set.add(batch.plantVariety);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [batches]);

  const locationOptions = React.useMemo(() => {
    const set = new Set<string>();
    (batches || []).forEach((batch) => {
      if (batch.location) set.add(batch.location);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [batches]);

  const filteredBatches = React.useMemo(() => {
    const dataToFilter = batches || [];
    const q = (searchQuery || '').trim();
    const filtered = dataToFilter
      .filter((batch) => queryMatchesBatch(q, batch))
      .filter((batch) =>
        filters.plantFamily === 'all' || batch.plantFamily === filters.plantFamily
      )
      .filter((batch) =>
        filters.category === 'all' || batch.category === filters.category
      )
      .filter((batch) => (
        filters.variety === 'all' || (batch.plantVariety ?? '') === filters.variety
      ))
      .filter((batch) => (
        filters.location === 'all' || (batch.location ?? '') === filters.location
      ))
      .filter((batch) => {
        if (filters.status === 'all') return true;
        if (filters.status === 'Active') return batch.status !== 'Archived';
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

  const handleDetailOpenChange = React.useCallback(
    (open: boolean) => {
      setIsDetailDialogOpen(open);
      if (!open) {
        clearBatchQuery();
      }
    },
    [clearBatchQuery]
  );

  const handleLogAction = (batch: Batch, mode: ActionMode) => {
    setSelectedBatch(batch);
    setLogActionMode(mode);
    setIsLogActionOpen(true);
  };
  
  const handleTransplantOpen = React.useCallback((batch: Batch) => {
    setSelectedBatch(batch);
    setIsTransplantOpen(true);
  }, []);
  
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

  const [isScanOpen, setIsScanOpen] = React.useState(false);

  const normalizeBatchNode = React.useCallback(
    (node: any): Batch => {
      const normalized = {
        id: node.id,
        orgId: node.orgId ?? node.org_id ?? orgId ?? "",
        batchNumber: String(node.batchNumber ?? node.batch_number ?? ""),
        phase: (node.phase ?? "propagation") as Batch["phase"],
        supplierId: node.supplierId ?? node.supplier_id ?? undefined,
        plantVarietyId:
          node.plantVarietyId ??
          node.plant_variety_id ??
          node.plantVariety ??
          "",
        sizeId: node.sizeId ?? node.size_id ?? "",
        locationId: node.locationId ?? node.location_id ?? "",
        status: (node.status ?? "Propagation") as Batch["status"],
        quantity: node.quantity ?? 0,
        initialQuantity: node.initialQuantity ?? node.quantity ?? 0,
        quantityProduced: node.quantityProduced ?? undefined,
        unit: node.unit ?? "plants",
        plantedAt: node.plantingDate ?? node.plantedAt ?? null,
        readyAt: node.producedAt ?? node.readyAt ?? null,
        dispatchedAt: node.dispatchedAt ?? null,
        archivedAt: node.archivedAt ?? null,
        qrCode: node.qrCode ?? undefined,
        qrImageUrl: node.qrImageUrl ?? undefined,
        passportOverrideA: undefined,
        passportOverrideB: undefined,
        passportOverrideC: undefined,
        passportOverrideD: undefined,
        logHistory: node.logHistory ?? [],
        supplierBatchNumber: node.supplierBatchNumber ?? "",
        createdAt: node.createdAt ?? null,
        updatedAt: node.updatedAt ?? null,
        plantVariety: node.plantVariety ?? node.variety ?? "",
        plantFamily: node.plantFamily ?? "",
        size: node.size ?? node.potSize ?? "",
        location: node.location ?? "",
      } as Batch;
      return normalized;
    },
    [orgId]
  );

  const fetchBatchNode = React.useCallback(
    async (batchId: string) => {
      const res = await fetch(`/api/batches/${batchId}`);
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? "Failed to load batch");
      const node = json.data?.batch ?? json.batch ?? json;
      return normalizeBatchNode(node);
    },
    [normalizeBatchNode]
  );

  const handleAiCareClick = async () => {
    if (!batches || batches.length === 0) return;
    const batchForRecs = batches[0];
    setSelectedBatch(batchForRecs);
    setIsRecommendationsOpen(true);
  };

  const handleScanDetected = React.useCallback(
    async (text: string) => {
      if (!text) return;
      try {
        const res = await fetch("/api/batches/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code: text }),
        });

        if (res.ok) {
          const { batch } = await res.json();
          const normalized = normalizeBatchNode(batch);
          setSelectedBatch(normalized);
          setIsDetailDialogOpen(true);
          setIsScanOpen(false);
          router.replace(
            `/?batch=${encodeURIComponent(
              normalized.id ?? normalized.batchNumber
            )}`
          );
          setBatches((prev) => {
            if (!prev) return [normalized];
            const exists = prev.some((b) => b.id === normalized.id);
            if (exists) {
              return prev.map((b) =>
                b.id === normalized.id ? { ...b, ...normalized } : b
              );
            }
            return [normalized, ...prev];
          });
        } else if (res.status === 404) {
          toast({
            variant: "destructive",
            title: "Not found",
            description: "No batch matched the scanned code.",
          });
        } else if (res.status === 422) {
          toast({
            variant: "destructive",
            title: "Unsupported code",
            description: "This code format is not recognized.",
          });
        } else if (res.status === 429) {
          toast({
            variant: "destructive",
            title: "Slow down",
            description: "Too many scans in a short period. Please wait a moment.",
          });
        } else if (res.status === 401) {
          toast({
            variant: "destructive",
            title: "Unauthorized",
            description: "Session expired. Please sign in again.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Scan failed",
            description: `Server responded with ${res.status}.`,
          });
        }
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Scan failed",
          description: err?.message || "Could not look up that batch.",
        });
      }
    },
    [normalizeBatchNode, router, toast]
  );

  const handleAncestrySelect = React.useCallback(
    async (batchId: string) => {
      if (!batchId) return;
      try {
        let existing = batches?.find((b) => b.id === batchId);
        if (!existing) {
          existing = await fetchBatchNode(batchId);
          setBatches((prev) => {
            if (!prev) return [existing as Batch];
            const idx = prev.findIndex((b) => b.id === batchId);
            if (idx === -1) return [existing as Batch, ...prev];
            const copy = [...prev];
            copy[idx] = existing as Batch;
            return copy;
          });
        }
        if (existing) {
          setSelectedBatch(existing);
          setIsDetailDialogOpen(true);
          router.replace(
            `/?batch=${encodeURIComponent(existing.id ?? existing.batchNumber)}`
          );
        }
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Unable to open batch",
          description: err?.message ?? "Could not load that batch.",
        });
      }
    },
    [batches, fetchBatchNode, router, toast]
  );

  const refreshSelectedBatch = React.useCallback(async () => {
    if (!selectedBatch?.id) return;
    try {
      const updated = await fetchBatchNode(selectedBatch.id);
      setBatches((prev) => {
        if (!prev) return [updated];
        return prev.map((b) => (b.id === updated.id ? updated : b));
      });
      setSelectedBatch(updated);
    } catch (err) {
      console.error("Failed to refresh batch:", err);
    }
  }, [selectedBatch?.id, fetchBatchNode]);
  
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
    <ReferenceDataProvider>
    <PageFrame moduleKey="production">
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
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => {
                                setIsPlanIncomingOpen(true);
                            }}>
                                Plan Incoming
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => {
                                setIsPlanBatchesOpen(true);
                            }}>
                                Plan Batches
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => {
                                setIsActualizeOpen(true);
                            }}>
                                Actualize Batches
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <TransplantMenuButton className="w-full sm:w-auto" />
                </>
            }
        />

        {/* View Toggle - always visible */}
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {filteredBatches.length} batch{filteredBatches.length !== 1 ? 'es' : ''}
            {filters.status !== 'all' || filters.plantFamily !== 'all' || filters.variety !== 'all' || filters.location !== 'all' || filters.category !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-6 px-2 text-xs"
                onClick={() => setFilters({ plantFamily: 'all', category: 'all', status: 'Active', variety: 'all', location: 'all' })}
              >
                Clear filters
              </Button>
            ) : null}
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

        {/* Filters - only in card view */}
        {viewMode === "card" && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters((f) => ({ ...f, status: value }))}
            >
              <SelectTrigger className="h-9 w-[130px] text-sm">
                <SelectValue placeholder="Status" />
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
              value={filters.plantFamily}
              onValueChange={(value) => setFilters((f) => ({ ...f, plantFamily: value }))}
            >
              <SelectTrigger className="h-9 w-[130px] text-sm">
                <SelectValue placeholder="Family" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Families</SelectItem>
                {(plantFamilies || []).map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.variety}
              onValueChange={(value) => setFilters((f) => ({ ...f, variety: value }))}
            >
              <SelectTrigger className="h-9 w-[140px] text-sm">
                <SelectValue placeholder="Variety" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Varieties</SelectItem>
                {varietyOptions.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.location}
              onValueChange={(value) => setFilters((f) => ({ ...f, location: value }))}
            >
              <SelectTrigger className="h-9 w-[130px] text-sm">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locationOptions.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {viewMode === "card" ? (
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
                ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[130px]">
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
                    <TableHead className="min-w-[140px]">
                      <div className="flex items-center gap-1">
                        <Select
                          value={filters.variety}
                          onValueChange={(value) => setFilters((f) => ({ ...f, variety: value }))}
                        >
                          <SelectTrigger className="h-8 border-0 bg-transparent shadow-none px-0 font-medium text-muted-foreground hover:text-foreground w-auto">
                            <SelectValue placeholder="Variety" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Varieties</SelectItem>
                            {varietyOptions.map((v) => (
                              <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleSort('variety')}
                        >
                          {sortConfig.key === 'variety' ? (
                            sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[120px]">
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
                            {(plantFamilies || []).map((p) => (
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
                    <TableHead className="min-w-[100px]">
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
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Growing">Growing</SelectItem>
                            <SelectItem value="Ready for Sale">Ready for Sale</SelectItem>
                            <SelectItem value="Archived">Archived</SelectItem>
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
                    <TableHead className="min-w-[100px]">
                      <div className="flex items-center gap-1">
                        <Select
                          value={filters.location}
                          onValueChange={(value) => setFilters((f) => ({ ...f, location: value }))}
                        >
                          <SelectTrigger className="h-8 border-0 bg-transparent shadow-none px-0 font-medium text-muted-foreground hover:text-foreground w-auto">
                            <SelectValue placeholder="Location" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Locations</SelectItem>
                            {locationOptions.map((loc) => (
                              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleSort('location')}
                        >
                          {sortConfig.key === 'location' ? (
                            sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </Button>
                      </div>
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
                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {authLoading
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
                          onClick={() => handleOpenDetail(batch)}
                        >
                          <TableCell className="font-mono text-sm">{batch.batchNumber}</TableCell>
                          <TableCell>
                            <div className="font-medium">{batch.plantVariety || "Unspecified"}</div>
                            <div className="text-xs text-muted-foreground">
                              {batch.size || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {batch.plantFamily || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {batch.phase && (
                                <Badge variant="secondary" className="capitalize text-xs">
                                  {batch.phase}
                                </Badge>
                              )}
                              {batch.status && (
                                <Badge variant="outline" className="text-xs">
                                  {batch.status}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{batch.location || "—"}</TableCell>
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
            </CardContent>
          </Card>
        )}
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
          onOpenChange={handleDetailOpenChange}
          batch={selectedBatch}
          onEdit={handleEditBatch}
          onTransplant={handleTransplantOpen}
          onLogAction={handleLogAction}
          onGenerateProtocol={handleGenerateProtocol}
          onCareRecommendations={handleRecommendations}
          onSelectRelatedBatch={handleAncestrySelect}
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
        batch={selectedBatch}
        locations={nurseryLocations || []}
        mode={logActionMode}
        onSuccess={refreshSelectedBatch}
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
                forceRefresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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
              Pick variety, tray size, quantity and starting location for propagation or import from CSV.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="form" className="min-h-0 flex flex-col">
            <TabsList className="mx-6 mb-4 w-fit">
              <TabsTrigger value="form">Single entry</TabsTrigger>
              <TabsTrigger value="bulk">Bulk CSV upload</TabsTrigger>
            </TabsList>
            <TabsContent
              value="form"
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-6"
            >
              <PropagationForm
                onSubmitSuccess={() => {
                  forceRefresh();
                }}
              />
            </TabsContent>
            <TabsContent
              value="bulk"
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-6"
            >
              <BulkPropagationUpload
                onComplete={() => {
                  forceRefresh();
                }}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Check-in Batch Dialog */}
      <CheckInWizardDialog
        open={isCheckinFormOpen}
        onOpenChange={setIsCheckinFormOpen}
        onSuccess={(batch) => {
          const batchNumber = batch?.batch_number ?? batch?.batchNumber ?? "";
          toast({ title: "Check-in Successful", description: batchNumber ? `Batch #${batchNumber} created.` : "Batch created." });
          forceRefresh();
        }}
      />

      {/* Plan Incoming Dialog */}
      <PlanIncomingWizardDialog
        open={isPlanIncomingOpen}
        onOpenChange={setIsPlanIncomingOpen}
        onSuccess={(result) => {
          toast({
            title: "Batches Planned",
            description: `${result.created} batch${result.created !== 1 ? 'es' : ''} created with "Incoming" status.`
          });
          forceRefresh();
        }}
      />

      {/* Plan Batches Dialog */}
      <PlanBatchesWizardDialog
        open={isPlanBatchesOpen}
        onOpenChange={setIsPlanBatchesOpen}
        onSuccess={(result) => {
          toast({
            title: "Batches Planned",
            description: `${result.created} batch${result.created !== 1 ? 'es' : ''} created with "Planned" status.`
          });
          forceRefresh();
        }}
      />

      {/* Actualize Batches Dialog */}
      <ActualizeWizardDialog
        open={isActualizeOpen}
        onOpenChange={setIsActualizeOpen}
        onSuccess={(result) => {
          toast({
            title: "Batches Actualized",
            description: `${result.actualized} batch${result.actualized !== 1 ? 'es' : ''} now active.`
          });
          forceRefresh();
        }}
      />

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
    </ReferenceDataProvider>
  );
}
