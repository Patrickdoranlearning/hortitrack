'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronRight,
  Search,
  Loader2,
  Package,
  MapPin,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlannedBatch = {
  id: string;
  batchNumber: string;
  varietyId: string;
  varietyName: string;
  varietyFamily: string | null;
  sizeId: string;
  sizeName: string;
  quantity: number;
  status: string;
  phase: string;
  locationId: string | null;
  locationName: string | null;
  plannedDate: string | null;
  parentBatchId: string | null;
  parentBatchNumber: string | null;
};

export type SelectPlannedBatchesStepData = {
  selectedBatches: PlannedBatch[];
};

type SelectPlannedBatchesStepProps = {
  initialData: SelectPlannedBatchesStepData | null;
  onComplete: (data: SelectPlannedBatchesStepData) => void;
  onCancel?: () => void;
};

export function SelectPlannedBatchesStep({
  initialData,
  onComplete,
  onCancel,
}: SelectPlannedBatchesStepProps) {
  const [batches, setBatches] = useState<PlannedBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialData?.selectedBatches.map((b) => b.id) ?? [])
  );

  // Fetch planned batches
  useEffect(() => {
    const fetchBatches = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/production/batches/planned?limit=500');
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to fetch batches');
        }
        const data = await response.json();

        const mapped: PlannedBatch[] = (data.batches || []).map((b: any) => ({
          id: b.id,
          batchNumber: b.batch_number,
          varietyId: b.plant_variety_id,
          varietyName: b.plant_varieties?.name ?? 'Unknown',
          varietyFamily: b.plant_varieties?.family ?? null,
          sizeId: b.size_id,
          sizeName: b.plant_sizes?.name ?? 'Unknown',
          quantity: b.quantity ?? 0,
          status: b.status ?? 'Planned',
          phase: b.phase ?? 'propagation',
          locationId: b.location_id,
          locationName: b.locations?.name ?? null,
          plannedDate: b.planted_at,
          parentBatchId: b.parent_batch_id,
          parentBatchNumber: b.parent_batch?.batch_number ?? null,
        }));

        setBatches(mapped);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBatches();
  }, []);

  // Get unique locations for filter
  const locations = useMemo(() => {
    const locs = new Map<string, string>();
    batches.forEach((b) => {
      if (b.locationId && b.locationName) {
        locs.set(b.locationId, b.locationName);
      }
    });
    return Array.from(locs.entries()).map(([id, name]) => ({ id, name }));
  }, [batches]);

  // Get unique phases for filter
  const phases = useMemo(() => {
    return Array.from(new Set(batches.map((b) => b.phase)));
  }, [batches]);

  // Filter batches
  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        batch.batchNumber.toLowerCase().includes(searchLower) ||
        batch.varietyName.toLowerCase().includes(searchLower) ||
        (batch.varietyFamily?.toLowerCase().includes(searchLower) ?? false);

      // Location filter
      const matchesLocation =
        locationFilter === 'all' ||
        (locationFilter === 'unassigned' && !batch.locationId) ||
        batch.locationId === locationFilter;

      // Phase filter
      const matchesPhase = phaseFilter === 'all' || batch.phase === phaseFilter;

      return matchesSearch && matchesLocation && matchesPhase;
    });
  }, [batches, searchQuery, locationFilter, phaseFilter]);

  // Toggle batch selection
  const toggleBatch = useCallback((batch: PlannedBatch) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(batch.id)) {
        next.delete(batch.id);
      } else {
        next.add(batch.id);
      }
      return next;
    });
  }, []);

  // Select all visible
  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredBatches.forEach((b) => next.add(b.id));
      return next;
    });
  }, [filteredBatches]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Get selected batches
  const selectedBatches = useMemo(() => {
    return batches.filter((b) => selectedIds.has(b.id));
  }, [batches, selectedIds]);

  const isValid = selectedBatches.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onComplete({ selectedBatches });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading planned batches...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No planned batches found</p>
        <p className="mt-1">Create planned batches first using the Plan Batches wizard.</p>
        {onCancel && (
          <Button variant="outline" className="mt-4" onClick={onCancel}>
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search batches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            {phases.map((phase) => (
              <SelectItem key={phase} value={phase}>
                {phase.charAt(0).toUpperCase() + phase.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selection Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All ({filteredBatches.length})
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear ({selectedIds.size})
            </Button>
          )}
        </div>
        <Badge variant="secondary">
          {selectedIds.size} selected
        </Badge>
      </div>

      {/* Batch List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Planned Batches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[350px] overflow-y-auto divide-y">
            {filteredBatches.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No batches match your filters
              </div>
            ) : (
              filteredBatches.map((batch) => {
                const isSelected = selectedIds.has(batch.id);

                return (
                  <div
                    key={batch.id}
                    className={cn(
                      'flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer',
                      isSelected && 'bg-primary/5'
                    )}
                    onClick={() => toggleBatch(batch)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleBatch(batch)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{batch.batchNumber}</span>
                        <Badge variant="outline" className="text-xs">
                          {batch.status}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {batch.phase}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="font-medium">{batch.varietyName}</span>
                        {batch.varietyFamily && (
                          <span className="ml-1">({batch.varietyFamily})</span>
                        )}
                        <span className="mx-2">•</span>
                        <span>{batch.sizeName}</span>
                      </div>
                      {batch.parentBatchNumber && (
                        <div className="text-xs text-muted-foreground mt-1">
                          From: {batch.parentBatchNumber}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{batch.quantity.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        {batch.locationName ? (
                          <>
                            <MapPin className="h-3 w-3" />
                            {batch.locationName}
                          </>
                        ) : (
                          <span className="text-amber-600">No location</span>
                        )}
                      </div>
                      {batch.plannedDate && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(batch.plannedDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <div />
        )}
        <Button type="button" onClick={handleSubmit} disabled={!isValid}>
          Next: Actualize Batches
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
