'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  CheckCircle2,
  Circle,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlannedBatch } from './SelectPlannedBatchesStep';
import type { ReferenceData } from '@/lib/referenceData/service';
import { useTodayDate, getTodayISO } from '@/lib/date-sync';

export type ActualizedBatchEntry = {
  batchId: string;
  batchNumber: string;
  varietyName: string;
  sizeId: string;
  sizeName: string;
  plannedQuantity: number;
  actualQuantity: number;
  actualLocationId: string | null;
  actualLocationName: string | null;
  actualDate: string;
  notes: string | null;
  isActualized: boolean;
};

export type ActualizeByLocationStepData = {
  entries: ActualizedBatchEntry[];
};

type ActualizeByLocationStepProps = {
  referenceData: Omit<ReferenceData, 'errors'>;
  selectedBatches: PlannedBatch[];
  initialData: ActualizeByLocationStepData | null;
  onComplete: (data: ActualizeByLocationStepData) => void;
  onBack?: () => void;
};

// Group batches by location
function groupByLocation(batches: PlannedBatch[]): Map<string, PlannedBatch[]> {
  const groups = new Map<string, PlannedBatch[]>();

  batches.forEach((batch) => {
    const key = batch.locationId || '__unassigned__';
    const existing = groups.get(key) || [];
    groups.set(key, [...existing, batch]);
  });

  return groups;
}

export function ActualizeByLocationStep({
  referenceData,
  selectedBatches,
  initialData,
  onComplete,
  onBack,
}: ActualizeByLocationStepProps) {
  // Use hydration-safe date to prevent server/client mismatch
  const today = useTodayDate();

  // Initialize entries from selected batches or initial data
  const [entries, setEntries] = useState<ActualizedBatchEntry[]>(() => {
    if (initialData && Array.isArray(initialData.entries) && initialData.entries.length) {
      return initialData.entries;
    }

    return selectedBatches.map((batch) => ({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      varietyName: batch.varietyName,
      sizeId: batch.sizeId,
      sizeName: batch.sizeName,
      plannedQuantity: batch.quantity,
      actualQuantity: batch.quantity, // Default to planned
      actualLocationId: batch.locationId,
      actualLocationName: batch.locationName,
      actualDate: '', // Empty initially, set after hydration
      notes: null,
      isActualized: false,
    }));
  });

  // Set date after hydration for entries without dates
  useEffect(() => {
    if (today) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.actualDate ? entry : { ...entry, actualDate: today }
        )
      );
    }
  }, [today]);

  // Group entries by location for the accordion view
  const locationGroups = useMemo(() => {
    const groups = new Map<string, ActualizedBatchEntry[]>();

    entries.forEach((entry) => {
      const key = entry.actualLocationId || '__unassigned__';
      const existing = groups.get(key) || [];
      groups.set(key, [...existing, entry]);
    });

    // Sort so unassigned is last
    const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === '__unassigned__') return 1;
      if (b === '__unassigned__') return -1;
      return 0;
    });

    return sortedEntries;
  }, [entries]);

  // Get location name for display
  const getLocationName = useCallback(
    (locationId: string | null) => {
      if (!locationId || locationId === '__unassigned__') return 'Unassigned';
      const loc = referenceData.locations.find((l) => l.id === locationId);
      return loc?.name ?? 'Unknown';
    },
    [referenceData.locations]
  );

  // Update a single entry
  const updateEntry = useCallback((batchId: string, updates: Partial<ActualizedBatchEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.batchId === batchId ? { ...e, ...updates } : e))
    );
  }, []);

  // Mark entry as actualized (toggle)
  const toggleActualized = useCallback((batchId: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.batchId === batchId ? { ...e, isActualized: !e.isActualized } : e
      )
    );
  }, []);

  // Mark all in a location as actualized
  const markLocationActualized = useCallback((locationId: string | null) => {
    const key = locationId || '__unassigned__';
    setEntries((prev) =>
      prev.map((e) => {
        const entryKey = e.actualLocationId || '__unassigned__';
        return entryKey === key ? { ...e, isActualized: true } : e;
      })
    );
  }, []);

  // Apply same date to all
  const applyDateToAll = useCallback((date: string) => {
    setEntries((prev) => prev.map((e) => ({ ...e, actualDate: date })));
  }, []);

  // Stats
  const totalBatches = entries.length;
  const actualizedCount = entries.filter((e) => e.isActualized).length;
  const totalPlannedQuantity = entries.reduce((sum, e) => sum + e.plannedQuantity, 0);
  const totalActualQuantity = entries.reduce((sum, e) => sum + e.actualQuantity, 0);

  // Validation: all must be actualized
  const isValid = entries.every((e) => e.isActualized);

  const handleSubmit = () => {
    if (!isValid) return;
    onComplete({ entries });
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {actualizedCount}/{totalBatches}
                </div>
                <div className="text-sm text-muted-foreground">Batches Done</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{locationGroups.length}</div>
                <div className="text-sm text-muted-foreground">Locations</div>
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
                  {totalActualQuantity !== totalPlannedQuantity && (
                    <span className="text-amber-600 ml-1">
                      ({totalActualQuantity > totalPlannedQuantity ? '+' : ''}
                      {totalActualQuantity - totalPlannedQuantity})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Global Date Setter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap">Actual Date:</Label>
            <Input
              type="date"
              value={entries[0]?.actualDate ?? today}
              onChange={(e) => applyDateToAll(e.target.value)}
              className="max-w-[180px]"
            />
            <span className="text-sm text-muted-foreground">
              Applied to all batches
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Location Groups */}
      <Accordion type="multiple" defaultValue={locationGroups.map(([key]) => key)} className="space-y-2">
        {locationGroups.map(([locationKey, groupEntries]) => {
          const locationName = getLocationName(locationKey === '__unassigned__' ? null : locationKey);
          const groupActualized = groupEntries.filter((e) => e.isActualized).length;
          const allDone = groupActualized === groupEntries.length;

          return (
            <AccordionItem key={locationKey} value={locationKey} className="border rounded-lg">
              <div className="flex items-center justify-between px-4">
                <AccordionTrigger className="flex-1 hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <MapPin className={cn('h-4 w-4', allDone ? 'text-green-600' : 'text-muted-foreground')} />
                    <span className="font-medium">{locationName}</span>
                    <Badge variant={allDone ? 'default' : 'secondary'}>
                      {groupActualized}/{groupEntries.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                {!allDone && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markLocationActualized(locationKey === '__unassigned__' ? null : locationKey)}
                  >
                    Mark All Done
                  </Button>
                )}
              </div>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {groupEntries.map((entry) => (
                    <div
                      key={entry.batchId}
                      className={cn(
                        'border rounded-lg p-4 transition-colors',
                        entry.isActualized && 'bg-green-50 border-green-200'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleActualized(entry.batchId)}
                            className="mt-1"
                          >
                            {entry.isActualized ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">
                                {entry.batchNumber}
                              </span>
                              {entry.isActualized && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Done
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {entry.varietyName} • {entry.sizeName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Actual Quantity */}
                          <div className="text-right">
                            <Label className="text-xs text-muted-foreground">Quantity</Label>
                            <Input
                              type="number"
                              value={entry.actualQuantity}
                              onChange={(e) =>
                                updateEntry(entry.batchId, {
                                  actualQuantity: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-24 text-right"
                              min={0}
                            />
                            {entry.actualQuantity !== entry.plannedQuantity && (
                              <div className="text-xs text-amber-600 mt-1">
                                Planned: {entry.plannedQuantity.toLocaleString()}
                              </div>
                            )}
                          </div>

                          {/* Location Override */}
                          <div>
                            <Label className="text-xs text-muted-foreground">Location</Label>
                            <Select
                              value={entry.actualLocationId || '__unassigned__'}
                              onValueChange={(value) =>
                                updateEntry(entry.batchId, {
                                  actualLocationId: value === '__unassigned__' ? null : value,
                                  actualLocationName:
                                    value === '__unassigned__'
                                      ? null
                                      : referenceData.locations.find((l) => l.id === value)?.name ??
                                      null,
                                })
                              }
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                                {referenceData.locations.map((loc) => (
                                  <SelectItem key={loc.id} value={loc.id}>
                                    {loc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Notes (expandable) */}
                      {entry.isActualized && (
                        <div className="mt-3 pt-3 border-t">
                          <Textarea
                            placeholder="Notes (optional)..."
                            value={entry.notes || ''}
                            onChange={(e) =>
                              updateEntry(entry.batchId, { notes: e.target.value || null })
                            }
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Validation Message */}
      {!isValid && (
        <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
          Please mark all batches as done before continuing. Click the circle icon next to each
          batch or use "Mark All Done" for each location.
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        ) : (
          <div />
        )}
        <Button type="button" onClick={handleSubmit} disabled={!isValid}>
          Next: Review
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
