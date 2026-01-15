'use client';

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchJson } from '@/lib/http/fetchJson';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Material, MaterialStock } from '@/lib/types/materials';

type StockAdjustDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  onSuccess?: () => void;
};

export function StockAdjustDialog({
  open,
  onOpenChange,
  material,
  onSuccess,
}: StockAdjustDialogProps) {
  // Fetch current stock for the material
  const { data: stockData, isLoading: isLoadingStock, mutate: mutateStock } = useSWR<{ stock: MaterialStock[] }>(
    open && material ? `/api/materials/${material.id}/stock` : null,
    (url) => fetchJson(url)
  );

  // Calculate total stock on hand across all locations
  const currentStock = useMemo(() => {
    if (!stockData?.stock) return 0;
    return stockData.stock.reduce((sum, s) => sum + (s.quantityOnHand || 0), 0);
  }, [stockData]);
  const { toast } = useToast();
  const [mode, setMode] = useState<'add' | 'count'>('add');
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState<string>('received');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!material) return;

    setIsSubmitting(true);
    try {
      if (mode === 'add') {
        // Simple add stock
        if (quantity === 0) {
          toast({ title: 'Quantity must be non-zero', variant: 'destructive' });
          return;
        }
        await fetchJson(`/api/materials/${material.id}/stock/adjust`, {
          method: 'POST',
          body: JSON.stringify({
            quantity,
            reason,
            notes: notes || undefined,
            isCount: false,
          }),
        });
        toast({ title: `Stock ${quantity > 0 ? 'added' : 'removed'} successfully` });
      } else {
        // Physical count
        await fetchJson(`/api/materials/${material.id}/stock/adjust`, {
          method: 'POST',
          body: JSON.stringify({
            quantity,
            notes: notes || undefined,
            isCount: true,
          }),
        });
        toast({ title: 'Physical count recorded' });
      }

      // Reset form and close
      setQuantity(0);
      setReason('received');
      setNotes('');
      onOpenChange(false);
      mutateStock();
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Failed to adjust stock',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [material, mode, quantity, reason, notes, toast, onOpenChange, onSuccess, mutateStock]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setQuantity(0);
      setReason('received');
      setNotes('');
      setMode('add');
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  const adjustment = mode === 'count' ? quantity - currentStock : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            {material && (
              <>
                <span className="font-mono">{material.partNumber}</span> - {material.name}
                <br />
                Current stock:{' '}
                {isLoadingStock ? (
                  <Skeleton className="inline-block h-4 w-12" />
                ) : (
                  <strong>{currentStock.toLocaleString()}</strong>
                )}{' '}
                {material.baseUom}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'add' | 'count')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">Add/Remove</TabsTrigger>
            <TabsTrigger value="count">Physical Count</TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity to Add</Label>
              <Input
                id="qty"
                type="number"
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                placeholder="Enter quantity..."
              />
              <p className="text-sm text-muted-foreground">
                Use positive to add stock, negative to remove
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">Goods Received</SelectItem>
                  <SelectItem value="damaged">Damaged/Broken</SelectItem>
                  <SelectItem value="lost">Lost/Missing</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="correction">Correction</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="count" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="count-qty">Counted Quantity</Label>
              <Input
                id="count-qty"
                type="number"
                min={0}
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                placeholder="Enter counted quantity..."
              />
              <p className="text-sm text-muted-foreground">
                Enter the actual quantity on hand
              </p>
            </div>

            {quantity !== currentStock && (
              <p className="text-sm font-medium">
                Adjustment:{' '}
                <span className={adjustment > 0 ? 'text-green-600' : adjustment < 0 ? 'text-red-600' : ''}>
                  {adjustment > 0 ? '+' : ''}{adjustment}
                </span>
              </p>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes..."
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || (mode === 'add' && quantity === 0)}
          >
            {isSubmitting ? 'Saving...' : mode === 'count' ? 'Record Count' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
