'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { VarietyComboboxGrouped } from '@/components/ui/variety-combobox-grouped';
import { SizeComboboxGrouped } from '@/components/ui/size-combobox-grouped';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LocationComboboxGrouped } from '@/components/ui/location-combobox-grouped';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Sprout,
  Package,
} from 'lucide-react';
import type { ReferenceData } from '@/contexts/ReferenceDataContext';
import type { SupplierExpectedDateData } from './SupplierExpectedDateStep';

export type PlannedBatchEntry = {
  id: string; // temp ID for UI
  varietyId: string;
  varietyName: string;
  varietyFamily: string | null;
  sizeId: string;
  sizeName: string;
  expectedQuantity: number;
  locationId?: string; // Optional - may not be known yet
  locationName?: string;
  notes?: string;
};

export type PlanBatchesStepData = {
  batches: PlannedBatchEntry[];
};

type PlanBatchesStepProps = {
  referenceData: ReferenceData;
  supplierData: SupplierExpectedDateData;
  initialData: PlanBatchesStepData | null;
  onComplete: (data: PlanBatchesStepData) => void;
  onBack: () => void;
};

export function PlanBatchesStep({
  referenceData,
  supplierData,
  initialData,
  onComplete,
  onBack,
}: PlanBatchesStepProps) {
  const [batches, setBatches] = useState<PlannedBatchEntry[]>(initialData?.batches ?? []);

  // New batch form state
  const [showAddForm, setShowAddForm] = useState(batches.length === 0);
  const [newVarietyId, setNewVarietyId] = useState('');
  const [newSizeId, setNewSizeId] = useState('');
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [newTrays, setNewTrays] = useState<number>(0);
  const [newLocationId, setNewLocationId] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const varieties = referenceData.varieties ?? [];
  const sizes = referenceData.sizes ?? [];
  const locations = referenceData.locations ?? [];

  // Find the "Virtual / Transit – Incoming" location (handles en-dash, em-dash, or hyphen)
  const defaultIncomingLocationId = useMemo(() => {
    const loc = locations.find(
      (l) =>
        l.nursery_site === 'Virtual' &&
        /^transit\s*[\u2013\u2014\-–—]\s*incoming$/i.test(l.name)
    );
    return loc?.id ?? '';
  }, [locations]);

  // Set default location when locations become available
  useEffect(() => {
    if (!newLocationId && defaultIncomingLocationId) {
      setNewLocationId(defaultIncomingLocationId);
    }
  }, [defaultIncomingLocationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedSize = useMemo(
    () => sizes.find((s) => s.id === newSizeId),
    [sizes, newSizeId]
  );
  const cellMultiple = selectedSize?.cell_multiple ?? 1;
  const isTraySize = cellMultiple > 1;
  // Group locations by site for the table Select dropdown
  const groupedLocations = useMemo(() => {
    const groups = new Map<string, typeof locations>();
    for (const loc of locations) {
      const site = loc.nursery_site || 'Other';
      if (!groups.has(site)) groups.set(site, []);
      groups.get(site)!.push(loc);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([site, locs]) => ({
        site,
        locs: locs.slice().sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [locations]);

  // Format location name with site for disambiguation (e.g. "Main Nursery · Tunnel 1")
  const formatLocationName = useCallback((location: (typeof locations)[number] | null | undefined) => {
    if (!location) return undefined;
    return location.nursery_site
      ? `${location.nursery_site} · ${location.name}`
      : location.name;
  }, []);

  // Compute total from trays for tray sizes
  const computedTotal = isTraySize ? newTrays * cellMultiple : newQuantity;

  // Add planned batch
  const handleAddBatch = useCallback(() => {
    if (!newVarietyId || !newSizeId || !computedTotal) return;

    const variety = varieties.find((v) => v.id === newVarietyId);
    const size = sizes.find((s) => s.id === newSizeId);
    const location = newLocationId ? locations.find((l) => l.id === newLocationId) : null;

    const entry: PlannedBatchEntry = {
      id: `planned-${Date.now()}`,
      varietyId: newVarietyId,
      varietyName: variety?.name ?? 'Unknown',
      varietyFamily: variety?.family ?? null,
      sizeId: newSizeId,
      sizeName: size?.name ?? 'Unknown',
      expectedQuantity: computedTotal,
      locationId: newLocationId || undefined,
      locationName: formatLocationName(location),
      notes: newNotes || undefined,
    };

    setBatches((b) => [...b, entry]);
    // Reset form but keep it open for adding more
    setNewVarietyId('');
    setNewSizeId('');
    setNewQuantity(0);
    setNewTrays(0);
    setNewLocationId(defaultIncomingLocationId);
    setNewNotes('');
  }, [newVarietyId, newSizeId, computedTotal, newLocationId, newNotes, varieties, sizes, locations, formatLocationName, defaultIncomingLocationId]);

  // Remove batch
  const removeBatch = useCallback((batchId: string) => {
    setBatches((b) => b.filter((batch) => batch.id !== batchId));
  }, []);

  // Update batch quantity
  const updateBatchQuantity = useCallback((batchId: string, quantity: number) => {
    setBatches((b) =>
      b.map((batch) =>
        batch.id === batchId ? { ...batch, expectedQuantity: Math.max(1, quantity) } : batch
      )
    );
  }, []);

  // Update batch location
  const updateBatchLocation = useCallback((batchId: string, locationId: string | null) => {
    const location = locationId ? locations.find((l) => l.id === locationId) : null;
    setBatches((b) =>
      b.map((batch) =>
        batch.id === batchId
          ? { ...batch, locationId: locationId || undefined, locationName: formatLocationName(location) }
          : batch
      )
    );
  }, [locations, formatLocationName]);

  const isValid = batches.length > 0;
  const canAddBatch = newVarietyId && newSizeId && computedTotal > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onComplete({ batches });
  };

  const totalUnits = batches.reduce((sum, b) => sum + b.expectedQuantity, 0);

  return (
    <div className="space-y-6">
      {/* Summary Badge */}
      <div className="flex items-center gap-4">
        <Badge variant={batches.length > 0 ? 'default' : 'secondary'} className="text-sm">
          {batches.length} batch{batches.length !== 1 ? 'es' : ''} · {totalUnits.toLocaleString()} units expected
        </Badge>
        <span className="text-sm text-muted-foreground">
          from {supplierData.supplierName} on {new Date(supplierData.expectedDate).toLocaleDateString()}
        </span>
      </div>

      {/* Added Batches Table */}
      {batches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Planned Batches
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variety</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="w-[120px]">Expected Qty</TableHead>
                  <TableHead className="w-[180px]">Location</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{batch.varietyName}</span>
                        {batch.varietyFamily && (
                          <span className="text-muted-foreground ml-1">({batch.varietyFamily})</span>
                        )}
                      </div>
                      {batch.notes && (
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                          {batch.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{batch.sizeName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={batch.expectedQuantity}
                        onChange={(e) => updateBatchQuantity(batch.id, parseInt(e.target.value) || 1)}
                        className="w-24 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={batch.locationId || '__tbd__'}
                        onValueChange={(v) => updateBatchLocation(batch.id, v === '__tbd__' ? null : v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="TBD" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="__tbd__">TBD</SelectItem>
                          {groupedLocations.map(({ site, locs }) => (
                            <SelectGroup key={site}>
                              <SelectLabel className="text-xs font-semibold text-muted-foreground">{site}</SelectLabel>
                              {locs.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeBatch(batch.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add New Batch Form */}
      {!showAddForm && batches.length > 0 ? (
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Batch
        </Button>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sprout className="h-4 w-4" />
              {batches.length === 0 ? 'Add Expected Batch' : 'Add Another Batch'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Variety */}
              <div className="space-y-2">
                <Label>Variety *</Label>
                <VarietyComboboxGrouped
                  varieties={varieties}
                  value={newVarietyId}
                  onSelect={(id) => setNewVarietyId(id)}
                  placeholder="Select variety..."
                  createHref="/varieties"
                  createLabel="Add new variety"
                />
              </div>

              {/* Size */}
              <div className="space-y-2">
                <Label>Size *</Label>
                <SizeComboboxGrouped
                  sizes={sizes}
                  value={newSizeId}
                  onSelect={(id) => {
                    setNewSizeId(id);
                    // Reset quantity inputs when size changes
                    setNewQuantity(0);
                    setNewTrays(0);
                  }}
                  placeholder="Select size..."
                  createHref="/sizes"
                  createLabel="Add new size"
                />
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                {isTraySize ? (
                  <>
                    <Label>Number of Trays *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newTrays || ''}
                      onChange={(e) => setNewTrays(parseInt(e.target.value) || 0)}
                      placeholder={`How many trays of ${cellMultiple}?`}
                    />
                    {newTrays > 0 && (
                      <p className="text-sm text-muted-foreground">
                        = <span className="font-medium text-foreground">{(newTrays * cellMultiple).toLocaleString()}</span> total units ({newTrays} × {cellMultiple} cells)
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Label>Expected Quantity *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newQuantity || ''}
                      onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                      placeholder="Enter expected quantity"
                    />
                  </>
                )}
              </div>

              {/* Location (Optional) */}
              <div className="space-y-2">
                <Label>
                  Location
                  <Badge variant="outline" className="ml-2 font-normal text-xs">Optional</Badge>
                </Label>
                <LocationComboboxGrouped
                  locations={locations}
                  value={newLocationId}
                  onSelect={(id) => setNewLocationId(id)}
                  placeholder="Select location (or leave TBD)..."
                  emptyLabel="TBD (decide at check-in)"
                  emptyValue=""
                  createHref="/locations"
                  createLabel="Add new location"
                  triggerClassName="w-full"
                />
              </div>
            </div>

            {/* Notes (Optional) */}
            <div className="space-y-2">
              <Label>
                Notes
                <Badge variant="outline" className="ml-2 font-normal text-xs">Optional</Badge>
              </Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Any special instructions or notes for this batch..."
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end">
              {batches.length > 0 && (
                <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                  Done Adding
                </Button>
              )}
              <Button onClick={handleAddBatch} disabled={!canAddBatch}>
                <Plus className="h-4 w-4 mr-1" />
                Add Batch
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={!isValid}>
          Next: Review
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
