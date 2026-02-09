'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  MapPin,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePickingWizardStore } from '@/stores/use-picking-wizard-store';
import ScannerClient from '@/components/Scanner/ScannerClient';
import { BatchPicker } from '@/components/picking/BatchPicker';
import type { PickItem } from '@/server/sales/picking';

interface SubstituteBatch {
  id: string;
  batchNumber: string;
  location?: string;
  availableQty: number;
}

export default function PickingStepPick() {
  const { toast } = useToast();
  const {
    pickList,
    items,
    updateItem,
    nextStep,
    prevStep,
    getProgress,
    canProceed,
    setLoading,
    isLoading,
  } = usePickingWizardStore();

  // The item currently being picked (opens BatchPicker)
  const [pickingItem, setPickingItem] = useState<PickItem | null>(null);

  // Substitution state
  const [showSubstitutionDialog, setShowSubstitutionDialog] = useState(false);
  const [substitutionItem, setSubstitutionItem] = useState<PickItem | null>(null);
  const [substituteBatches, setSubstituteBatches] = useState<SubstituteBatch[]>([]);
  const [selectedSubstituteBatch, setSelectedSubstituteBatch] = useState<string>('');
  const [substitutionReason, setSubstitutionReason] = useState('');
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [showSubstitutionScanner, setShowSubstitutionScanner] = useState(false);

  // Handle scanning for substitution
  const handleSubstitutionScan = useCallback(async (scannedText: string) => {
    setShowSubstitutionScanner(false);
    const batchCode = scannedText.startsWith('BATCH:')
      ? scannedText.slice(6)
      : scannedText;

    const matchingBatch = substituteBatches.find(
      (b) => b.batchNumber.toLowerCase() === batchCode.toLowerCase()
    );

    if (matchingBatch) {
      setSelectedSubstituteBatch(matchingBatch.id);
      toast({
        title: 'Batch Found',
        description: `Selected ${matchingBatch.batchNumber} (${matchingBatch.availableQty} available)`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Batch Not Found',
        description: `"${batchCode}" is not available for substitution`,
      });
    }
  }, [substituteBatches, toast]);

  // Derived values
  const progress = getProgress();
  const pendingItems = items.filter((item) => item.status === 'pending');
  const completedItems = items.filter((item) => item.status !== 'pending');

  if (!pickList) {
    return null;
  }

  // === Item Actions ===

  const handlePickConfirm = async (
    item: PickItem,
    batches: Array<{ batchId: string; quantity: number }>,
    notes?: string
  ) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/picking/${pickList.id}/items/${item.id}/batches`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batches, notes }),
        }
      );

      const data = await res.json();

      if (!res.ok || data.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error || 'Failed to save picks',
        });
        return;
      }

      const totalPicked = batches.reduce((sum, b) => sum + b.quantity, 0);

      updateItem(item.id, {
        status: data.status || (totalPicked >= item.targetQty ? 'picked' : 'short'),
        pickedQty: data.pickedQty || totalPicked,
      });

      toast({
        title: 'Item Picked',
        description: `${item.productName || item.plantVariety} picked from ${batches.length} batch(es)`,
      });

      setPickingItem(null);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save picks',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkShort = async (item: PickItem) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/picking/${pickList.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickItemId: item.id,
          pickedQty: 0,
          status: 'short',
        }),
      });

      const data = await res.json();

      if (data.error) {
        toast({ variant: 'destructive', title: 'Error', description: data.error });
        return;
      }

      updateItem(item.id, { status: 'short', pickedQty: 0 });
      toast({
        title: 'Marked Short',
        description: `${item.productName || item.plantVariety} marked as unavailable`,
        variant: 'destructive',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to mark short' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubstitute = async (item: PickItem) => {
    setSubstitutionItem(item);
    setShowSubstitutionDialog(true);
    setLoadingBatches(true);
    setSelectedSubstituteBatch('');
    setSubstitutionReason('');

    try {
      const res = await fetch(`/api/picking/${pickList.id}/items/${item.id}/batches`);
      const data = await res.json();
      if (data.batches) {
        setSubstituteBatches(data.batches);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load batches' });
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleConfirmSubstitution = async () => {
    if (!substitutionItem || !selectedSubstituteBatch) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/picking/${pickList.id}/items/${substitutionItem.id}/batches`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: selectedSubstituteBatch,
            reason: substitutionReason,
          }),
        }
      );

      const data = await res.json();
      if (data.error) {
        toast({ variant: 'destructive', title: 'Error', description: data.error });
        return;
      }

      const selectedBatch = substituteBatches.find((b) => b.id === selectedSubstituteBatch);
      updateItem(substitutionItem.id, {
        status: 'substituted',
        pickedQty: substitutionItem.targetQty,
        pickedBatchId: selectedSubstituteBatch,
        pickedBatchNumber: selectedBatch?.batchNumber,
        substitutionReason,
      });

      toast({
        title: 'Substitution Confirmed',
        description: `Batch substituted for ${substitutionItem.productName || substitutionItem.plantVariety}`,
      });

      setShowSubstitutionDialog(false);
      setSubstitutionItem(null);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to substitute' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Picking Progress</span>
            <span className="text-sm text-muted-foreground">
              {progress.picked}/{progress.total} items
            </span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {progress.percentage}% complete
          </p>
        </CardContent>
      </Card>

      {/* Pending Items — tappable cards */}
      {pendingItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Items to Pick
            <Badge variant="secondary">{pendingItems.length}</Badge>
          </h3>

          {pendingItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Tappable main area — opens BatchPicker */}
                <button
                  onClick={() => setPickingItem(item)}
                  className="w-full p-4 text-left active:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item.productName || item.plantVariety || 'Unknown'}
                      </p>
                      {item.requiredVarietyName && item.requiredVarietyName !== item.plantVariety && (
                        <p className="text-sm text-primary/80 truncate">{item.requiredVarietyName}</p>
                      )}
                      <p className="text-sm text-muted-foreground">{item.size}</p>
                      {item.batchLocation && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {item.batchLocation}
                        </p>
                      )}
                      {item.originalBatchNumber && (
                        <p className="text-xs text-blue-600 mt-1">
                          Batch: {item.originalBatchNumber}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 text-lg px-3 py-1">
                      x{item.targetQty}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-primary font-medium">
                    <Camera className="h-4 w-4" />
                    Tap to pick
                  </div>
                </button>

                {/* Secondary actions — smaller, in a border-top row */}
                <div className="flex border-t divide-x">
                  <button
                    onClick={() => handleSubstitute(item)}
                    className="flex-1 py-2.5 text-xs text-muted-foreground flex items-center justify-center gap-1 hover:bg-muted/50 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Substitute
                  </button>
                  <button
                    onClick={() => handleMarkShort(item)}
                    disabled={isLoading}
                    className="flex-1 py-2.5 text-xs text-red-600 flex items-center justify-center gap-1 hover:bg-red-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Short
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed Items */}
      {completedItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            Completed
            <Badge variant="outline" className="text-green-600 border-green-600">
              {completedItems.length}
            </Badge>
          </h3>

          {completedItems.map((item) => (
            <Card
              key={item.id}
              className={cn(
                'opacity-75',
                item.status === 'short' && 'border-red-200 bg-red-50'
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.status === 'short' ? (
                      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm">
                        {item.productName || item.plantVariety}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.status === 'short'
                          ? 'Unavailable'
                          : item.status === 'substituted'
                          ? `Substituted: ${item.pickedBatchNumber}`
                          : `Picked: ${item.pickedBatchNumber || item.originalBatchNumber || 'multi-batch'}`}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={item.status === 'short' ? 'destructive' : 'secondary'}
                    className="shrink-0"
                  >
                    {item.pickedQty}/{item.targetQty}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* All Done Message */}
      {pendingItems.length === 0 && completedItems.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-green-700">All items picked!</p>
            <p className="text-sm text-green-600">Ready to proceed to QC</p>
          </CardContent>
        </Card>
      )}

      {/* BatchPicker — the unified pick flow */}
      <BatchPicker
        open={!!pickingItem}
        onOpenChange={(open) => { if (!open) setPickingItem(null); }}
        pickListId={pickList.id}
        itemId={pickingItem?.id || ''}
        productName={pickingItem?.productName || pickingItem?.plantVariety || 'Unknown'}
        targetQty={pickingItem?.targetQty || 0}
        onConfirm={async (batches, notes) => {
          if (!pickingItem) return;
          await handlePickConfirm(pickingItem, batches, notes);
        }}
        isSubmitting={isLoading}
      />

      {/* Substitution Dialog */}
      <Dialog open={showSubstitutionDialog} onOpenChange={setShowSubstitutionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substitute Batch</DialogTitle>
            <DialogDescription>
              Select an alternative batch for {substitutionItem?.productName || substitutionItem?.plantVariety}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loadingBatches ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : substituteBatches.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No alternative batches available
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Select Batch</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSubstitutionScanner(true)}
                      className="gap-1"
                    >
                      <Camera className="h-4 w-4" />
                      Scan
                    </Button>
                  </div>
                  <Select
                    value={selectedSubstituteBatch}
                    onValueChange={setSelectedSubstituteBatch}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a batch or scan" />
                    </SelectTrigger>
                    <SelectContent>
                      {substituteBatches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.batchNumber} - {batch.availableQty} available
                          {batch.location && ` (${batch.location})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Substitution</Label>
                  <Textarea
                    id="reason"
                    value={substitutionReason}
                    onChange={(e) => setSubstitutionReason(e.target.value)}
                    placeholder="Why are you substituting this batch?"
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubstitutionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSubstitution}
              disabled={!selectedSubstituteBatch || isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Substitution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Substitution Scanner */}
      <Dialog open={showSubstitutionScanner} onOpenChange={setShowSubstitutionScanner}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Substitute Batch</DialogTitle>
            <DialogDescription>
              Scan a batch label to select it for substitution
            </DialogDescription>
          </DialogHeader>
          {showSubstitutionScanner && (
            <ScannerClient onDecoded={handleSubstitutionScan} />
          )}
        </DialogContent>
      </Dialog>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-pb">
        <div className="flex gap-3">
          <Button variant="outline" onClick={prevStep} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={nextStep}
            disabled={!canProceed()}
            className={cn('flex-1', canProceed() && 'bg-green-600 hover:bg-green-700')}
          >
            Continue to QC
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
