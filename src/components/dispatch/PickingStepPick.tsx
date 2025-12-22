'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
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
  Scan,
  Keyboard,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePickingWizardStore } from '@/stores/use-picking-wizard-store';
import ScannerClient from '@/components/Scanner/ScannerClient';
import type { PickItem, PickItemStatus } from '@/server/sales/picking';

type PickAction = 'confirm' | 'substitute' | 'short';

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

  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PickItem | null>(null);
  const [selectedAction, setSelectedAction] = useState<PickAction | null>(null);
  const [manualBatchCode, setManualBatchCode] = useState('');
  
  // Substitution state
  const [showSubstitutionDialog, setShowSubstitutionDialog] = useState(false);
  const [substituteBatches, setSubstituteBatches] = useState<SubstituteBatch[]>([]);
  const [selectedSubstituteBatch, setSelectedSubstituteBatch] = useState<string>('');
  const [substitutionReason, setSubstitutionReason] = useState('');
  const [loadingBatches, setLoadingBatches] = useState(false);

  const progress = getProgress();
  const pendingItems = items.filter((item) => item.status === 'pending');
  const completedItems = items.filter((item) => item.status !== 'pending');

  if (!pickList) {
    return null;
  }

  const handleScan = useCallback(async (scannedText: string) => {
    if (!selectedItem || !pickList) return;

    setShowScanner(false);
    setLoading(true);

    try {
      // Parse the scanned batch code
      // Expected format might be "BATCH:xxx" or just "xxx"
      const batchCode = scannedText.startsWith('BATCH:')
        ? scannedText.slice(6)
        : scannedText;

      // Verify and confirm the pick
      const res = await fetch(`/api/picking/${pickList.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickItemId: selectedItem.id,
          pickedQty: selectedItem.targetQty,
          scannedBatchCode: batchCode,
        }),
      });

      const data = await res.json();

      if (data.error) {
        toast({
          variant: 'destructive',
          title: 'Scan Error',
          description: data.error,
        });
        return;
      }

      // Update local state
      updateItem(selectedItem.id, {
        status: 'picked',
        pickedQty: selectedItem.targetQty,
        pickedBatchId: data.batchId,
        pickedBatchNumber: batchCode,
      });

      toast({
        title: 'Item Picked',
        description: `${selectedItem.productName || selectedItem.plantVariety} confirmed`,
      });

      setSelectedItem(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to confirm pick',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedItem, pickList, updateItem, toast, setLoading]);

  const handleConfirmPick = async (item: PickItem) => {
    if (!pickList) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/picking/${pickList.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickItemId: item.id,
          pickedQty: item.targetQty,
          pickedBatchId: item.originalBatchId,
        }),
      });

      const data = await res.json();

      if (data.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error,
        });
        return;
      }

      updateItem(item.id, {
        status: 'picked',
        pickedQty: item.targetQty,
        pickedBatchId: item.originalBatchId,
      });

      toast({
        title: 'Item Picked',
        description: `${item.productName || item.plantVariety} confirmed`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to confirm pick',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubstitute = async (item: PickItem) => {
    setSelectedItem(item);
    setShowSubstitutionDialog(true);
    setLoadingBatches(true);

    try {
      // Fetch available batches for substitution
      const res = await fetch(`/api/picking/${pickList?.id}/items/${item.id}/batches`);
      const data = await res.json();
      
      if (data.batches) {
        setSubstituteBatches(data.batches);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load available batches',
      });
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleConfirmSubstitution = async () => {
    if (!selectedItem || !selectedSubstituteBatch || !pickList) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/picking/${pickList.id}/items/${selectedItem.id}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: selectedSubstituteBatch,
          reason: substitutionReason,
        }),
      });

      const data = await res.json();

      if (data.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error,
        });
        return;
      }

      const selectedBatch = substituteBatches.find((b) => b.id === selectedSubstituteBatch);

      updateItem(selectedItem.id, {
        status: 'substituted',
        pickedQty: selectedItem.targetQty,
        pickedBatchId: selectedSubstituteBatch,
        pickedBatchNumber: selectedBatch?.batchNumber,
        substitutionReason,
      });

      toast({
        title: 'Substitution Confirmed',
        description: `Batch substituted for ${selectedItem.productName || selectedItem.plantVariety}`,
      });

      setShowSubstitutionDialog(false);
      setSelectedItem(null);
      setSelectedSubstituteBatch('');
      setSubstitutionReason('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to substitute batch',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkShort = async (item: PickItem) => {
    if (!pickList) return;
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
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error,
        });
        return;
      }

      updateItem(item.id, {
        status: 'short',
        pickedQty: 0,
      });

      toast({
        title: 'Marked Short',
        description: `${item.productName || item.plantVariety} marked as unavailable`,
        variant: 'destructive',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to mark item as short',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartScan = (item: PickItem) => {
    setSelectedItem(item);
    setShowScanner(true);
  };

  const handleManualEntry = (item: PickItem) => {
    setSelectedItem(item);
    setShowManualEntry(true);
    setManualBatchCode('');
  };

  const handleManualSubmit = async () => {
    if (!selectedItem || !manualBatchCode.trim()) return;
    await handleScan(manualBatchCode.trim());
    setShowManualEntry(false);
    setManualBatchCode('');
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

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Items to Pick
            <Badge variant="secondary">{pendingItems.length}</Badge>
          </h3>

          {pendingItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {item.productName || item.plantVariety || 'Unknown'}
                    </p>
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
                    ×{item.targetQty}
                  </Badge>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleStartScan(item)}
                    className="flex-1"
                  >
                    <Camera className="h-4 w-4 mr-1" />
                    Scan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleManualEntry(item)}
                  >
                    <Keyboard className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleConfirmPick(item)}
                    disabled={isLoading}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSubstitute(item)}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Substitute
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleMarkShort(item)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Short
                  </Button>
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
                          : `Picked: ${item.pickedBatchNumber || item.originalBatchNumber}`}
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

      {/* Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Batch</DialogTitle>
            <DialogDescription>
              Scan the batch label for {selectedItem?.productName || selectedItem?.plantVariety}
            </DialogDescription>
          </DialogHeader>
          {showScanner && <ScannerClient onDecoded={handleScan} />}
        </DialogContent>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Entry</DialogTitle>
            <DialogDescription>
              Enter the batch code for {selectedItem?.productName || selectedItem?.plantVariety}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batchCode">Batch Code</Label>
              <Input
                id="batchCode"
                value={manualBatchCode}
                onChange={(e) => setManualBatchCode(e.target.value)}
                placeholder="Enter batch code"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualEntry(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualSubmit} disabled={!manualBatchCode.trim() || isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Substitution Dialog */}
      <Dialog open={showSubstitutionDialog} onOpenChange={setShowSubstitutionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substitute Batch</DialogTitle>
            <DialogDescription>
              Select an alternative batch for {selectedItem?.productName || selectedItem?.plantVariety}
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
                  <Label>Select Batch</Label>
                  <Select
                    value={selectedSubstituteBatch}
                    onValueChange={setSelectedSubstituteBatch}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a batch" />
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




