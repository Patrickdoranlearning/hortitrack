"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Sprout,
  BarChart2,
  Trash2,
  Share2,
  Loader2,
  ImageIcon,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import type { Batch } from '@/lib/types';
import type { StockMovement, PlantHealthEvent, DetailedDistribution, SimpleDistribution } from "@/lib/history-types";
import { ProductionProtocolDialog } from "./production-protocol-dialog";
import { CareRecommendationsDialog } from "./care-recommendations-dialog";
import { Badge } from "./ui/badge";
import { BatchChatDialog } from "./batch-chat-dialog";
import { InteractiveDistributionBar } from "./InteractiveDistributionBar";
import AncestryStrip from "./ancestry-strip";
import { PlantPassportCard } from "./batches/PlantPassportCard";
// ActionMenuButton removed - using LogActionWizard directly
import type { ActionMode } from "@/components/actions/types";
import { StockMovementLog } from "@/components/history/StockMovementLog";
import { PlantHealthLog } from "@/components/history/PlantHealthLog";
import { Package, Heart, Search, Plus, Trash2 as TrashIcon, Download } from "lucide-react";
import { StockAdjustmentDialog } from "@/components/batch/StockAdjustmentDialog";
import { RecordLossDialog } from "@/components/batch/RecordLossDialog";
import { AddHealthLogDialog } from "@/components/plant-health/AddHealthLogDialog";
import { ScoutLogCard } from "@/components/batches/ScoutLogCard";
import { LogActionWizard, type BatchInfo } from "@/components/batches/LogActionWizard";

// Lazy load gallery to avoid slowing down dialog open
const BatchGallerySection = dynamic(
  () => import("@/components/batches/BatchGallerySection"),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading photos...
      </div>
    ),
    ssr: false 
  }
);


interface BatchDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  onEdit: (batch: Batch) => void;
  onTransplant: (batch: Batch) => void;
  onLogAction: (batch: Batch, mode: ActionMode) => void;
  onGenerateProtocol: (batch: Batch) => void;
  onCareRecommendations: (batch: Batch) => void;
  onSelectRelatedBatch?: (batchId: string) => void;
}

export function BatchDetailDialog({
  open,
  onOpenChange,
  batch,
  onEdit,
  onTransplant,
  onLogAction,
  onGenerateProtocol,
  onCareRecommendations,
  onSelectRelatedBatch,
}: BatchDetailDialogProps) {

  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);

  // Dialog states for actions
  const [adjustDialogOpen, setAdjustDialogOpen] = React.useState(false);
  const [lossDialogOpen, setLossDialogOpen] = React.useState(false);
  const [healthLogDialogOpen, setHealthLogDialogOpen] = React.useState(false);
  const [isExportingStock, setIsExportingStock] = React.useState(false);

  // Scout logs state
  const [scoutLogs, setScoutLogs] = React.useState<PlantHealthEvent[]>([]);
  const [scoutLoading, setScoutLoading] = React.useState(false);
  const [scoutError, setScoutError] = React.useState<string | null>(null);

  // Stock movements state
  const [stockMovements, setStockMovements] = React.useState<StockMovement[]>([]);
  const [stockLoading, setStockLoading] = React.useState(false);
  const [stockError, setStockError] = React.useState<string | null>(null);

  // Plant health state
  const [healthLogs, setHealthLogs] = React.useState<PlantHealthEvent[]>([]);
  const [healthLoading, setHealthLoading] = React.useState(false);
  const [healthError, setHealthError] = React.useState<string | null>(null);

  // Distribution is now included inline with batch data from v_batch_search view
  // The detailed distribution API is only called when user clicks on a distribution bar segment

  // Fetch stock movements when dialog opens
  React.useEffect(() => {
    if (!open || !batch?.id) {
      setStockMovements([]);
      return;
    }

    let cancelled = false;
    setStockLoading(true);
    setStockError(null);

    fetch(`/api/production/batches/${batch.id}/stock-movements`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || res.statusText);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setStockMovements(data.movements || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStockError(err?.message || String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStockLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, batch?.id]);

  // Fetch plant health logs when dialog opens
  React.useEffect(() => {
    if (!open || !batch?.id) {
      setHealthLogs([]);
      return;
    }

    let cancelled = false;
    setHealthLoading(true);
    setHealthError(null);

    fetch(`/api/production/batches/${batch.id}/plant-health`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || res.statusText);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setHealthLogs(data.logs || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHealthError(err?.message || String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHealthLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, batch?.id]);

  // Fetch scout logs when dialog opens
  React.useEffect(() => {
    if (!open || !batch?.id) {
      setScoutLogs([]);
      return;
    }

    let cancelled = false;
    setScoutLoading(true);
    setScoutError(null);

    fetch(`/api/production/batches/${batch.id}/scout-logs`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || res.statusText);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setScoutLogs(data.logs || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setScoutError(err?.message || String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setScoutLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, batch?.id]);

  // Refresh functions
  const refreshStockMovements = React.useCallback(async () => {
    if (!batch?.id) return;
    setStockLoading(true);
    try {
      const res = await fetch(`/api/production/batches/${batch.id}/stock-movements`);
      const data = await res.json();
      setStockMovements(data.movements || []);
    } catch {
      // Ignore refresh errors
    } finally {
      setStockLoading(false);
    }
  }, [batch?.id]);

  const refreshHealthLogs = React.useCallback(async () => {
    if (!batch?.id) return;
    setHealthLoading(true);
    try {
      const res = await fetch(`/api/production/batches/${batch.id}/plant-health`);
      const data = await res.json();
      setHealthLogs(data.logs || []);
    } catch {
      // Ignore refresh errors
    } finally {
      setHealthLoading(false);
    }
  }, [batch?.id]);

  // Export stock movements
  const handleExportStock = async () => {
    if (!batch?.id) return;
    setIsExportingStock(true);
    try {
      const response = await fetch(`/api/production/batches/${batch.id}/stock-movements/export`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-movements-${batch.batchNumber || batch.id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExportingStock(false);
    }
  };

  // Callback for fetching detailed distribution
  const fetchDetailedDistribution = React.useCallback(async (batchId: string): Promise<DetailedDistribution> => {
    const res = await fetch(`/api/production/batches/${batchId}/distribution`);
    if (!res.ok) throw new Error('Failed to fetch distribution');
    return res.json();
  }, []);

  const getStatusVariant = (status: Batch['status']): 'default' | 'secondary' | 'destructive' | 'outline' | 'accent' | 'info' => {
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

  // Use inline distribution from batch data (no API call needed for simple display!)
  // Only fetch detailed distribution when user clicks on a segment
  const currentDistribution: SimpleDistribution = React.useMemo(() => {
    // Use inline distribution data if available (from v_batch_search view)
    if ((batch as any)?.distribution) {
      return (batch as any).distribution;
    }

    // Fallback for legacy data without distribution
    const qty = batch?.quantity ?? 0;
    return {
      available: qty,
      allocatedPotting: 0,
      allocatedSales: 0,
      sold: 0,
      dumped: 0,
      transplanted: 0,
      totalAccounted: qty,
    };
  }, [(batch as any)?.distribution, batch?.quantity]);


  if (!batch) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl grid-rows-[auto_1fr_auto] max-h-[90vh]">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="font-headline text-3xl">{batch.plantVariety}</DialogTitle>
                <DialogDescription>
                  Batch #{batch.batchNumber} • {batch.plantFamily}
                </DialogDescription>
              </div>
               <Badge variant={getStatusVariant(batch.status)} className="text-sm">{batch.status}</Badge>
            </div>
          </DialogHeader>

          <div className="grid md:grid-cols-3 gap-6 overflow-y-auto pr-2 -mr-2">
            <div className="md:col-span-2 space-y-6">
              <Tabs defaultValue="summary">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="stock" className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    Stock
                  </TabsTrigger>
                  <TabsTrigger value="health" className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" />
                    Care
                  </TabsTrigger>
                  <TabsTrigger value="scout" className="flex items-center gap-1">
                    <Search className="h-3.5 w-3.5" />
                    Observations
                  </TabsTrigger>
                  <TabsTrigger value="photos">
                    <ImageIcon className="h-4 w-4 mr-1" />
                    Photos
                  </TabsTrigger>
                  <TabsTrigger value="ancestry">Ancestry</TabsTrigger>
                </TabsList>

                {/* Summary Tab */}
                <TabsContent value="summary" className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium">{batch.location || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Size</p>
                      <p className="font-medium">{batch.size}</p>
                    </div>
                     <div>
                      <p className="text-muted-foreground">Planting Date</p>
                      <p className="font-medium">{new Date(batch.plantingDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Supplier</p>
                      <p className="font-medium">{batch.supplier || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Category</p>
                      <p className="font-medium">{batch.category}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Stock Distribution</p>
                    <InteractiveDistributionBar
                      distribution={currentDistribution}
                      batchId={batch.id}
                      onFetchDetails={fetchDetailedDistribution}
                    />
                  </div>
                  {batch.id && (
                    <PlantPassportCard batchId={batch.id} />
                  )}
                </TabsContent>

                {/* Stock Movement Tab */}
                <TabsContent value="stock">
                  <div className="flex items-center justify-between mt-4 mb-3">
                    <div className="text-sm text-muted-foreground">
                      Current: <span className="font-semibold text-foreground">{(batch.quantity ?? 0).toLocaleString()}</span> units
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdjustDialogOpen(true)}
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adjust
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLossDialogOpen(true)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Loss
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportStock}
                        disabled={isExportingStock || stockMovements.length === 0}
                      >
                        {isExportingStock ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {stockLoading && (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Loading stock movements...
                      </div>
                    )}
                    {stockError && (
                      <div className="text-sm text-red-600 py-4">{stockError}</div>
                    )}
                    {!stockLoading && !stockError && stockMovements.length === 0 && (
                      <div className="text-muted-foreground py-4 text-center">No stock movements recorded yet.</div>
                    )}
                    {!stockLoading && stockMovements.length > 0 && (
                      <StockMovementLog movements={stockMovements} />
                    )}
                  </div>
                </TabsContent>

                {/* Plant Health Tab */}
                <TabsContent value="health">
                  <div className="flex items-center justify-between mt-4 mb-3">
                    <div className="text-sm text-muted-foreground">
                      {healthLogs.length} health event{healthLogs.length !== 1 ? 's' : ''} recorded
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHealthLogDialogOpen(true)}
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Log Event
                    </Button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {healthLoading && (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Loading health logs...
                      </div>
                    )}
                    {healthError && (
                      <div className="text-sm text-red-600 py-4">{healthError}</div>
                    )}
                    {!healthLoading && !healthError && healthLogs.length === 0 && (
                      <div className="text-muted-foreground py-4 text-center">No plant health logs recorded yet.</div>
                    )}
                    {!healthLoading && healthLogs.length > 0 && (
                      <PlantHealthLog logs={healthLogs} />
                    )}
                  </div>
                </TabsContent>

                {/* Scout Tab */}
                <TabsContent value="scout">
                  <div className="mt-4">
                    {scoutLoading && (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Loading scout observations...
                      </div>
                    )}
                    {scoutError && (
                      <div className="text-sm text-red-600 py-4">{scoutError}</div>
                    )}
                    {!scoutLoading && !scoutError && scoutLogs.length === 0 && (
                      <div className="text-muted-foreground py-4 text-center">
                        No scout observations for this batch yet.
                      </div>
                    )}
                    {!scoutLoading && scoutLogs.length > 0 && (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {scoutLogs.map((log) => (
                          <ScoutLogCard key={log.id} log={log} compact />
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Photos Tab */}
                <TabsContent value="photos" className="pt-4">
                  {batch.id && (
                    <BatchGallerySection
                      batchId={batch.id}
                      varietyId={batch.plantVarietyId}
                    />
                  )}
                </TabsContent>

                {/* Ancestry Tab */}
                <TabsContent value="ancestry">
                    <AncestryStrip
                      currentId={batch.id!}
                      onSelectBatch={(id) => onSelectRelatedBatch?.(id)}
                    />
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-3 flex flex-col">
              <h4 className="font-semibold text-lg">Actions</h4>
              <Button onClick={() => onEdit(batch)} variant="outline"><Pencil /> Edit Batch</Button>
              <Button onClick={() => onTransplant(batch)} variant="outline" disabled={(batch.quantity ?? 0) === 0}><Sprout /> Transplant</Button>
              <Button onClick={() => setIsWizardOpen(true)} variant="outline"><ClipboardList /> Log Action</Button>
              <Button onClick={() => setIsChatOpen(true)} variant="outline"><Share2 /> Chat about Batch</Button>
              {batch.id && (
                <Button asChild variant="outline">
                  <Link href={`/production/batches/${batch.id}`} target="_blank">
                    <ExternalLink className="mr-2 h-4 w-4" /> View Full Page
                  </Link>
                </Button>
              )}
              
              <div className="!mt-auto pt-4 border-t">
                  <h4 className="font-semibold text-lg mb-3">AI Tools</h4>
                  <div className="space-y-3">
                      <Button onClick={() => onCareRecommendations(batch)} variant="secondary" className="w-full justify-start"><BarChart2 /> Care Recommendations</Button>
                      <Button onClick={() => onGenerateProtocol(batch)} variant="secondary" className="w-full justify-start"><Trash2 /> Production Protocol</Button>
                  </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <BatchChatDialog
        open={isChatOpen}
        onOpenChange={setIsChatOpen}
        batchId={batch?.id}
        batchNumber={batch?.batchNumber}
      />

      {/* Stock Adjustment Dialog */}
      <StockAdjustmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        batchId={batch?.id || ''}
        batchNumber={batch?.batchNumber}
        currentQuantity={batch?.quantity ?? 0}
        onSuccess={() => refreshStockMovements()}
      />

      {/* Loss Recording Dialog */}
      <RecordLossDialog
        open={lossDialogOpen}
        onOpenChange={setLossDialogOpen}
        batchId={batch?.id || ''}
        batchNumber={batch?.batchNumber}
        currentQuantity={batch?.quantity ?? 0}
        onSuccess={() => refreshStockMovements()}
      />

      {/* Health Log Dialog */}
      <AddHealthLogDialog
        open={healthLogDialogOpen}
        onOpenChange={setHealthLogDialogOpen}
        batchId={batch?.id || ''}
        batchNumber={batch?.batchNumber}
        onSuccess={() => refreshHealthLogs()}
      />

      {/* Log Action Wizard */}
      <LogActionWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        batch={{
          id: batch?.id || '',
          batchNumber: batch?.batchNumber || '',
          variety: batch?.plantVariety?.toString(),
          quantity: batch?.quantity ?? 0,
          saleableQuantity: (batch as any)?.saleableQuantity ?? 0,
        }}
        onSuccess={() => {
          refreshStockMovements();
          refreshHealthLogs();
        }}
      />
    </>
  );
}
