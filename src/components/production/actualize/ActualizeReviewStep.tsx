'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  Package,
  MapPin,
  Loader2,
  Play,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import type { ActualizedBatchEntry } from './ActualizeByLocationStep';

export type ActualizeReviewStepData = {
  globalNotes?: string;
};

type ActualizeReviewStepProps = {
  entries: ActualizedBatchEntry[];
  initialData: ActualizeReviewStepData | null;
  onComplete: (data: ActualizeReviewStepData) => void;
  onBack: () => void;
  isSubmitting?: boolean;
};

export function ActualizeReviewStep({
  entries,
  initialData,
  onComplete,
  onBack,
  isSubmitting = false,
}: ActualizeReviewStepProps) {
  const [globalNotes, setGlobalNotes] = useState(initialData?.globalNotes ?? '');

  const handleSubmit = () => {
    onComplete({
      globalNotes: globalNotes || undefined,
    });
  };

  // Calculate stats
  const totalBatches = entries.length;
  const totalPlannedQuantity = entries.reduce((sum, e) => sum + e.plannedQuantity, 0);
  const totalActualQuantity = entries.reduce((sum, e) => sum + e.actualQuantity, 0);
  const quantityDiff = totalActualQuantity - totalPlannedQuantity;

  // Group by location for summary
  const locationCounts = new Map<string, number>();
  entries.forEach((e) => {
    const loc = e.actualLocationName || 'Unassigned';
    locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
  });

  // Entries with quantity changes
  const entriesWithChanges = entries.filter((e) => e.actualQuantity !== e.plannedQuantity);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Play className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalBatches}</div>
                <div className="text-sm text-muted-foreground">
                  Batch{totalBatches !== 1 ? 'es' : ''} to Activate
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {totalActualQuantity.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Plants
                  {quantityDiff !== 0 && (
                    <span className={quantityDiff > 0 ? 'text-green-600' : 'text-red-600'}>
                      {' '}
                      ({quantityDiff > 0 ? '+' : ''}{quantityDiff.toLocaleString()})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-lg font-bold">
                  {entries[0]?.actualDate
                    ? new Date(entries[0].actualDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </div>
                <div className="text-sm text-muted-foreground">Actualization Date</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            By Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Array.from(locationCounts.entries()).map(([loc, count]) => (
              <Badge key={loc} variant="secondary" className="text-sm">
                {loc}: {count} batch{count !== 1 ? 'es' : ''}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Batches Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Batches to Activate</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Variety</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const hasQuantityChange = entry.actualQuantity !== entry.plannedQuantity;

                return (
                  <TableRow key={entry.batchId}>
                    <TableCell className="font-mono text-sm">{entry.batchNumber}</TableCell>
                    <TableCell>
                      <span className="font-medium">{entry.varietyName}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.sizeName}</TableCell>
                    <TableCell className="text-right">
                      {hasQuantityChange ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground line-through">
                            {entry.plannedQuantity.toLocaleString()}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{entry.actualQuantity.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="font-medium">{entry.actualQuantity.toLocaleString()}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.actualLocationName ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {entry.actualLocationName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quantity Changes Alert */}
      {entriesWithChanges.length > 0 && (
        <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-4">
          <strong>Note:</strong> {entriesWithChanges.length} batch
          {entriesWithChanges.length !== 1 ? 'es have' : ' has'} different actual quantities than
          planned.
        </div>
      )}

      {/* Global Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Additional Notes
            <Badge variant="outline" className="ml-2 font-normal text-xs">
              Optional
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={globalNotes}
            onChange={(e) => setGlobalNotes(e.target.value)}
            placeholder="Any notes about this actualization..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* What Happens Next */}
      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
        <p>
          <strong>What happens next:</strong> These batches will be activated with "Growing" status.
          {' '}For transplant batches, the source batch quantities will be reduced accordingly.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Activating...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Activate {totalBatches} Batch{totalBatches !== 1 ? 'es' : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
