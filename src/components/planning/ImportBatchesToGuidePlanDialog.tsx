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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchJson } from '@/lib/http/fetchJson';
import { toast } from '@/lib/toast';
import { Import, Info, Loader2, Package } from 'lucide-react';
import { format } from 'date-fns';
import type { GuidePlanWithProgress } from '@/lib/planning/guide-plan-types';

type MatchingBatch = {
  id: string;
  batchNumber: string;
  quantity: number;
  status: string;
  phase: string;
  readyAt: string | null;
  sizeName: string | null;
  varietyId: string;
  varietyName: string;
  varietyFamily: string | null;
  batchPlanId: string | null;
};

type VarietyGroup = {
  varietyId: string;
  varietyName: string;
  batches: MatchingBatch[];
  totalQuantity: number;
};

type MatchingBatchesResponse = {
  guidePlanId: string;
  targetFamily: string;
  targetSizeId: string | null;
  matchingBatches: MatchingBatch[];
  batchesByVariety: {
    varietyId: string;
    varietyName: string;
    varietyFamily: string;
    batches: any[];
    totalQuantity: number;
  }[];
  summary: {
    totalBatches: number;
    totalQuantity: number;
    varietyCount: number;
  };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guidePlan: GuidePlanWithProgress;
  onSuccess?: () => void;
};

export function ImportBatchesToGuidePlanDialog({
  open,
  onOpenChange,
  guidePlan,
  onSuccess,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [data, setData] = React.useState<MatchingBatchesResponse | null>(null);
  const [selectedBatches, setSelectedBatches] = React.useState<Set<string>>(new Set());

  // Load matching batches when dialog opens
  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setSelectedBatches(new Set());
      fetchJson<MatchingBatchesResponse>(
        `/api/production/guide-plans/${guidePlan.id}/matching-batches`
      )
        .then(setData)
        .catch((err) => {
          toast.error(err?.message ?? 'Failed to load batches');
        })
        .finally(() => setLoading(false));
    }
  }, [open, guidePlan.id]);

  // Group batches by variety
  const varietyGroups = React.useMemo((): VarietyGroup[] => {
    if (!data?.matchingBatches) return [];

    const groups = new Map<string, VarietyGroup>();
    for (const batch of data.matchingBatches) {
      const existing = groups.get(batch.varietyId);
      if (existing) {
        existing.batches.push(batch);
        existing.totalQuantity += batch.quantity;
      } else {
        groups.set(batch.varietyId, {
          varietyId: batch.varietyId,
          varietyName: batch.varietyName,
          batches: [batch],
          totalQuantity: batch.quantity,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.varietyName.localeCompare(b.varietyName)
    );
  }, [data?.matchingBatches]);

  const toggleBatch = (batchId: string) => {
    setSelectedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const toggleVariety = (varietyGroup: VarietyGroup) => {
    setSelectedBatches((prev) => {
      const next = new Set(prev);
      const allSelected = varietyGroup.batches.every((b) => prev.has(b.id));
      if (allSelected) {
        // Deselect all
        varietyGroup.batches.forEach((b) => next.delete(b.id));
      } else {
        // Select all
        varietyGroup.batches.forEach((b) => next.add(b.id));
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!data?.matchingBatches) return;
    setSelectedBatches(new Set(data.matchingBatches.map((b) => b.id)));
  };

  const deselectAll = () => {
    setSelectedBatches(new Set());
  };

  // Calculate selected stats
  const selectedStats = React.useMemo(() => {
    if (!data?.matchingBatches) return { count: 0, quantity: 0, varieties: 0 };
    const selected = data.matchingBatches.filter((b) => selectedBatches.has(b.id));
    const varieties = new Set(selected.map((b) => b.varietyId));
    return {
      count: selected.length,
      quantity: selected.reduce((sum, b) => sum + b.quantity, 0),
      varieties: varieties.size,
    };
  }, [data?.matchingBatches, selectedBatches]);

  const handleImport = async () => {
    if (selectedBatches.size === 0) return;

    // Group selected batches by variety
    const varietyMap = new Map<string, string[]>();
    for (const batch of data?.matchingBatches ?? []) {
      if (selectedBatches.has(batch.id)) {
        const existing = varietyMap.get(batch.varietyId) ?? [];
        existing.push(batch.id);
        varietyMap.set(batch.varietyId, existing);
      }
    }

    const varieties = Array.from(varietyMap.entries()).map(([varietyId, batchIds]) => ({
      varietyId,
      batchIds,
    }));

    setSubmitting(true);
    try {
      const result = await fetchJson<{
        batchPlansCreated: number;
        batchesLinked: number;
        totalQuantity: number;
        errors: string[];
      }>(`/api/production/guide-plans/${guidePlan.id}/import-batches`, {
        method: 'POST',
        body: JSON.stringify({ varieties }),
      });

      if (result.errors.length > 0) {
        toast.warning(`Imported with warnings: ${result.errors.join(', ')}`);
      } else {
        toast.success(`Created ${result.batchPlansCreated} batch plan${result.batchPlansCreated !== 1 ? 's' : ''}, linked ${result.batchesLinked} batch${result.batchesLinked !== 1 ? 'es' : ''} (${result.totalQuantity.toLocaleString()} units)`);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to import batches');
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
            <Import className="h-5 w-5" />
            Import Existing Batches
          </DialogTitle>
          <DialogDescription>
            Import batches matching "{guidePlan.targetFamily}" into this guide plan. Batch
            plans will be auto-created for each variety.
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
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">Available to Import</p>
                  <p className="text-2xl font-semibold">
                    {data.summary.totalQuantity.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.summary.totalBatches} batch
                    {data.summary.totalBatches !== 1 && 'es'} across{' '}
                    {data.summary.varietyCount} variet
                    {data.summary.varietyCount !== 1 ? 'ies' : 'y'}
                  </p>
                </div>
                <div className="rounded-lg border p-4 bg-primary/10 border-primary/20">
                  <p className="text-sm text-muted-foreground">Selected to Import</p>
                  <p className="text-2xl font-semibold">
                    {selectedStats.quantity.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedStats.count} batch{selectedStats.count !== 1 && 'es'}
                    {selectedStats.varieties > 0 &&
                      ` (${selectedStats.varieties} variet${selectedStats.varieties !== 1 ? 'ies' : 'y'})`}
                  </p>
                </div>
              </div>

              {/* Info alert */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Importing batches will automatically create batch plans grouped by
                  variety. Each batch plan will inherit the guide plan's timeline and recipe
                  settings.
                </AlertDescription>
              </Alert>

              {/* Selection actions */}
              {varietyGroups.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Deselect All
                  </Button>
                </div>
              )}

              {/* Batches grouped by variety */}
              {varietyGroups.length > 0 ? (
                <Accordion type="multiple" className="w-full" defaultValue={varietyGroups.map(g => g.varietyId)}>
                  {varietyGroups.map((group) => {
                    const allSelected = group.batches.every((b) =>
                      selectedBatches.has(b.id)
                    );
                    const someSelected =
                      !allSelected && group.batches.some((b) => selectedBatches.has(b.id));
                    const selectedInGroup = group.batches.filter((b) =>
                      selectedBatches.has(b.id)
                    );
                    const selectedQty = selectedInGroup.reduce(
                      (sum, b) => sum + b.quantity,
                      0
                    );

                    return (
                      <AccordionItem key={group.varietyId} value={group.varietyId}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                              checked={allSelected}
                              // @ts-expect-error indeterminate is valid but not typed
                              indeterminate={someSelected}
                              onCheckedChange={() => toggleVariety(group)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex items-center gap-2 flex-1">
                              <span className="font-medium">{group.varietyName}</span>
                              <Badge variant="secondary">
                                {group.batches.length} batch
                                {group.batches.length !== 1 && 'es'}
                              </Badge>
                              <span className="text-muted-foreground text-sm">
                                {group.totalQuantity.toLocaleString()} total
                              </span>
                            </div>
                            {selectedInGroup.length > 0 && (
                              <Badge variant="default" className="mr-2">
                                {selectedQty.toLocaleString()} selected
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
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
                              {group.batches.map((batch) => (
                                <TableRow key={batch.id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedBatches.has(batch.id)}
                                      onCheckedChange={() => toggleBatch(batch.id)}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {batch.batchNumber}
                                  </TableCell>
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
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No unlinked batches found matching this guide plan.</p>
                  <p className="text-sm mt-1">
                    Batches must match the family "{guidePlan.targetFamily}"
                    {guidePlan.targetSizeName && ` and size "${guidePlan.targetSizeName}"`}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={submitting || selectedBatches.size === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Import className="mr-2 h-4 w-4" />
                Import {selectedStats.count} Batch{selectedStats.count !== 1 && 'es'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
