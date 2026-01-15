'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchJson } from '@/lib/http/fetchJson';
import { useToast } from '@/hooks/use-toast';
import { Link2, Unlink, Info, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { BatchPlanWithProgress } from '@/lib/planning/guide-plan-types';

type MatchingBatch = {
  id: string;
  batchNumber: string;
  quantity: number;
  status: string;
  phase: string;
  readyAt: string | null;
  sizeName: string | null;
  varietyName: string | null;
  batchPlanId: string | null;
};

type MatchingBatchesResponse = {
  batchPlanId: string;
  linkedBatches: MatchingBatch[];
  matchingBatches: MatchingBatch[];
  linkedToOtherPlans: MatchingBatch[];
  summary: {
    linkedCount: number;
    linkedQuantity: number;
    matchingCount: number;
    matchingQuantity: number;
  };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchPlan: BatchPlanWithProgress;
  onSuccess?: () => void;
};

export function LinkBatchesDialog({ open, onOpenChange, batchPlan, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [data, setData] = React.useState<MatchingBatchesResponse | null>(null);
  const [selectedToLink, setSelectedToLink] = React.useState<Set<string>>(new Set());
  const [selectedToUnlink, setSelectedToUnlink] = React.useState<Set<string>>(new Set());

  // Load matching batches when dialog opens
  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setSelectedToLink(new Set());
      setSelectedToUnlink(new Set());
      fetchJson<MatchingBatchesResponse>(
        `/api/production/batch-plans/${batchPlan.id}/matching-batches`
      )
        .then(setData)
        .catch((err) => {
          toast({
            title: 'Failed to load batches',
            description: err?.message ?? 'Unknown error',
            variant: 'destructive',
          });
        })
        .finally(() => setLoading(false));
    }
  }, [open, batchPlan.id, toast]);

  const toggleLinkSelection = (batchId: string) => {
    setSelectedToLink((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const toggleUnlinkSelection = (batchId: string) => {
    setSelectedToUnlink((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const handleLink = async () => {
    if (selectedToLink.size === 0) return;
    setSubmitting(true);
    try {
      await fetchJson(`/api/production/batch-plans/${batchPlan.id}/link-batches`, {
        method: 'POST',
        body: JSON.stringify({ batchIds: Array.from(selectedToLink) }),
      });
      toast({ title: `Linked ${selectedToLink.size} batch${selectedToLink.size !== 1 ? 'es' : ''}` });
      setSelectedToLink(new Set());
      // Refresh data
      const refreshed = await fetchJson<MatchingBatchesResponse>(
        `/api/production/batch-plans/${batchPlan.id}/matching-batches`
      );
      setData(refreshed);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Failed to link batches',
        description: error?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    if (selectedToUnlink.size === 0) return;
    setSubmitting(true);
    try {
      await fetchJson(`/api/production/batch-plans/${batchPlan.id}/link-batches`, {
        method: 'DELETE',
        body: JSON.stringify({ batchIds: Array.from(selectedToUnlink) }),
      });
      toast({ title: `Unlinked ${selectedToUnlink.size} batch${selectedToUnlink.size !== 1 ? 'es' : ''}` });
      setSelectedToUnlink(new Set());
      // Refresh data
      const refreshed = await fetchJson<MatchingBatchesResponse>(
        `/api/production/batch-plans/${batchPlan.id}/matching-batches`
      );
      setData(refreshed);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Failed to unlink batches',
        description: error?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'dd MMM yyyy');
    } catch {
      return date;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && onOpenChange(value)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link Existing Batches
          </DialogTitle>
          <DialogDescription>
            Link existing batches to "{batchPlan.plantVarietyName}" plan. Linked batches
            contribute to the plan's progress.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && data && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">Currently Linked</p>
                  <p className="text-2xl font-semibold">
                    {data.summary.linkedQuantity.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.summary.linkedCount} batch{data.summary.linkedCount !== 1 && 'es'}
                  </p>
                </div>
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">Available to Link</p>
                  <p className="text-2xl font-semibold">
                    {data.summary.matchingQuantity.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.summary.matchingCount} batch{data.summary.matchingCount !== 1 && 'es'}
                  </p>
                </div>
              </div>

              {/* Currently Linked Batches */}
              {data.linkedBatches.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Linked Batches</h3>
                    {selectedToUnlink.size > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUnlink}
                        disabled={submitting}
                      >
                        <Unlink className="mr-1.5 h-4 w-4" />
                        Unlink {selectedToUnlink.size} selected
                      </Button>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Ready</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.linkedBatches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedToUnlink.has(batch.id)}
                              onCheckedChange={() => toggleUnlinkSelection(batch.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                          <TableCell>{batch.sizeName ?? '-'}</TableCell>
                          <TableCell className="text-right">
                            {batch.quantity.toLocaleString()}
                          </TableCell>
                          <TableCell>{formatDate(batch.readyAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{batch.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Matching Batches (unlinked) */}
              {data.matchingBatches.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Available Batches (Same Variety & Size)</h3>
                    {selectedToLink.size > 0 && (
                      <Button size="sm" onClick={handleLink} disabled={submitting}>
                        <Link2 className="mr-1.5 h-4 w-4" />
                        Link {selectedToLink.size} selected
                      </Button>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Ready</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.matchingBatches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedToLink.has(batch.id)}
                              onCheckedChange={() => toggleLinkSelection(batch.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                          <TableCell>{batch.sizeName ?? '-'}</TableCell>
                          <TableCell className="text-right">
                            {batch.quantity.toLocaleString()}
                          </TableCell>
                          <TableCell>{formatDate(batch.readyAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{batch.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* No matching batches */}
              {data.matchingBatches.length === 0 && data.linkedBatches.length === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No batches found matching this plan's variety
                    {batchPlan.targetSizeName && ` and size (${batchPlan.targetSizeName})`}.
                  </AlertDescription>
                </Alert>
              )}

              {/* Info about batches linked to other plans */}
              {data.linkedToOtherPlans.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {data.linkedToOtherPlans.length} batch
                    {data.linkedToOtherPlans.length !== 1 && 'es'} with matching variety
                    {data.linkedToOtherPlans.length === 1 ? ' is' : ' are'} already linked to
                    other batch plans.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
