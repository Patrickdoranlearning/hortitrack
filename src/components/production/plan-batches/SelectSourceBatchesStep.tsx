'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  ChevronLeft,
  Search,
  Package,
  Loader2,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SourceBatch = {
  id: string;
  batchNumber: string;
  varietyId: string;
  varietyName: string;
  varietyFamily: string | null;
  sizeId: string;
  sizeName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  status: string;
  phase: string;
  locationName: string | null;
};

export type SelectSourceBatchesStepData = {
  plannedWeek: string; // ISO week format: YYYY-Www (e.g., "2025-W50")
  selectedBatches: SourceBatch[];
};

type SelectSourceBatchesStepProps = {
  initialData: SelectSourceBatchesStepData | null;
  onComplete: (data: SelectSourceBatchesStepData) => void;
  onBack: () => void;
};

// Helper to get current ISO week string
function getCurrentWeek(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

// Helper to format week for display
function formatWeekDisplay(weekStr: string): string {
  if (!weekStr) return '';
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  const [, year, week] = match;
  // Calculate the Monday of this week
  const jan4 = new Date(parseInt(year), 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (parseInt(week) - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `Week ${week}: ${formatDate(monday)} - ${formatDate(sunday)}`;
}

export function SelectSourceBatchesStep({
  initialData,
  onComplete,
  onBack,
}: SelectSourceBatchesStepProps) {
  const [plannedWeek, setPlannedWeek] = useState(
    initialData?.plannedWeek ?? getCurrentWeek()
  );
  const [batches, setBatches] = useState<SourceBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialData?.selectedBatches.map((b) => b.id) ?? [])
  );

  // Fetch batches that can be transplanted from
  useEffect(() => {
    async function fetchBatches() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/production/planning');
        if (!res.ok) throw new Error('Failed to load batches');
        const data = await res.json();

        // Map and filter batches - exclude Archived and Planned
        const mappedBatches: SourceBatch[] = (data.batches ?? [])
          .filter((b: any) => !['Archived', 'Planned'].includes(b.status))
          .map((b: any) => ({
            id: b.id,
            batchNumber: b.batchNumber || b.batch_number,
            varietyId: b.varietyId || b.plant_variety_id,
            varietyName: b.varietyName || b.variety_name || 'Unknown',
            varietyFamily: b.varietyFamily || b.family || null,
            sizeId: b.sizeId || b.size_id,
            sizeName: b.sizeName || b.size_name || 'Unknown',
            quantity: b.quantity ?? 0,
            reservedQuantity: b.reservedQuantity || b.reserved_quantity || 0,
            availableQuantity: (b.quantity ?? 0) - (b.reservedQuantity || b.reserved_quantity || 0),
            status: b.status,
            phase: b.phase,
            locationName: b.locationName || b.location_name || null,
          }));

        setBatches(mappedBatches);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchBatches();
  }, []);

  // Filter batches
  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          batch.batchNumber.toLowerCase().includes(query) ||
          batch.varietyName.toLowerCase().includes(query) ||
          (batch.varietyFamily?.toLowerCase().includes(query) ?? false);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter === 'active') {
        return !['Incoming', 'Archived', 'Planned'].includes(batch.status);
      } else if (statusFilter === 'incoming') {
        return batch.status === 'Incoming';
      } else if (statusFilter !== 'all') {
        return batch.status === statusFilter;
      }

      return true;
    });
  }, [batches, searchQuery, statusFilter]);

  // Toggle batch selection
  const toggleBatch = useCallback((batch: SourceBatch) => {
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

  // Get selected batches
  const selectedBatches = useMemo(() => {
    return batches.filter((b) => selectedIds.has(b.id));
  }, [batches, selectedIds]);

  const isValid = selectedBatches.length > 0 && plannedWeek;

  const handleSubmit = () => {
    if (!isValid) return;
    onComplete({ plannedWeek, selectedBatches });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading batches...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Planned Week */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Planned Transplant Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="week"
            value={plannedWeek}
            onChange={(e) => setPlannedWeek(e.target.value)}
            className="h-12 max-w-xs"
          />
          {plannedWeek && (
            <p className="text-sm text-muted-foreground mt-2">
              {formatWeekDisplay(plannedWeek)}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            When do you plan to perform these transplants?
          </p>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search batches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="incoming">Incoming</SelectItem>
            <SelectItem value="Propagation">Propagation</SelectItem>
            <SelectItem value="Plugs/Liners">Plugs/Liners</SelectItem>
            <SelectItem value="Potted">Potted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selection Summary */}
      <div className="flex items-center gap-4">
        <Badge variant={selectedBatches.length > 0 ? 'default' : 'secondary'} className="text-sm">
          {selectedBatches.length} batch{selectedBatches.length !== 1 ? 'es' : ''} selected
        </Badge>
        {selectedBatches.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs"
          >
            Clear selection
          </Button>
        )}
      </div>

      {/* Batch List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Select Source Batches
          </CardTitle>
          <CardDescription>
            Choose batches to transplant from. Quantity will be reserved when planned.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredBatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No batches found matching your criteria.</p>
            </div>
          ) : (
            filteredBatches.map((batch) => {
              const isSelected = selectedIds.has(batch.id);
              const hasAvailable = batch.availableQuantity > 0;

              return (
                <div
                  key={batch.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                    !hasAvailable && 'opacity-50',
                    hasAvailable && 'cursor-pointer'
                  )}
                  onClick={() => hasAvailable && toggleBatch(batch)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={!hasAvailable}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => hasAvailable && toggleBatch(batch)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{batch.batchNumber}</span>
                      <Badge variant="outline" className="text-xs">
                        {batch.status}
                      </Badge>
                      {batch.phase && (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {batch.phase}
                        </Badge>
                      )}
                    </div>
                    <div className="font-medium mt-1">
                      {batch.varietyName}
                      {batch.varietyFamily && (
                        <span className="text-muted-foreground ml-1">({batch.varietyFamily})</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {batch.sizeName}
                      {batch.locationName && ` · ${batch.locationName}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium">
                      {batch.availableQuantity.toLocaleString()}
                      <span className="text-muted-foreground font-normal"> avail.</span>
                    </div>
                    {batch.reservedQuantity > 0 && (
                      <div className="text-xs text-amber-600">
                        {batch.reservedQuantity.toLocaleString()} reserved
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      of {batch.quantity.toLocaleString()} total
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={!isValid}>
          Next: Configure Transplants
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
