'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Check,
  ChevronsUpDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Package,
  Sprout,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReferenceData } from '@/contexts/ReferenceDataContext';
import type { SupplierDeliveryData } from './SupplierDeliveryStep';

export type BatchEntry = {
  id: string; // temp ID for UI
  incomingBatchId?: string; // if from planned incoming
  varietyId: string;
  varietyName: string;
  varietyFamily: string | null;
  sizeId: string;
  sizeName: string;
  cellMultiple: number;
  quantity: number;
  locationId: string;
  locationName: string;
  isFromPlanned: boolean;
  plannedQuantity?: number; // original planned qty for reference
};

export type BatchesStepData = {
  batches: BatchEntry[];
};

type IncomingBatch = {
  id: string;
  batchNumber: string | null;
  varietyId: string | null;
  varietyName: string | null;
  sizeId: string | null;
  sizeName: string | null;
  quantity: number;
  supplierId: string | null;
  supplierName: string | null;
  locationId: string | null;
  locationName: string | null;
};

type BatchesStepProps = {
  referenceData: ReferenceData;
  supplierData: SupplierDeliveryData;
  incomingBatches: IncomingBatch[];
  initialData: BatchesStepData | null;
  onComplete: (data: BatchesStepData) => void;
  onBack: () => void;
};

export function BatchesStep({
  referenceData,
  supplierData,
  incomingBatches,
  initialData,
  onComplete,
  onBack,
}: BatchesStepProps) {
  // Filter incoming batches by selected supplier
  const filteredIncoming = useMemo(() => {
    return incomingBatches.filter(
      (b) => b.supplierId === supplierData.supplierId || !b.supplierId
    );
  }, [incomingBatches, supplierData.supplierId]);

  const [batches, setBatches] = useState<BatchEntry[]>(initialData?.batches ?? []);
  const [selectedIncomingIds, setSelectedIncomingIds] = useState<Set<string>>(
    new Set(initialData?.batches.filter(b => b.isFromPlanned).map(b => b.incomingBatchId!))
  );

  // New batch form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVarietyId, setNewVarietyId] = useState('');
  const [newSizeId, setNewSizeId] = useState('');
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [newLocationId, setNewLocationId] = useState('');
  const [varietyOpen, setVarietyOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const varieties = referenceData.varieties ?? [];
  const sizes = referenceData.sizes ?? [];
  const locations = referenceData.locations ?? [];

  const selectedVariety = useMemo(
    () => varieties.find((v) => v.id === newVarietyId),
    [varieties, newVarietyId]
  );
  const selectedSize = useMemo(
    () => sizes.find((s) => s.id === newSizeId),
    [sizes, newSizeId]
  );
  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === newLocationId),
    [locations, newLocationId]
  );

  // Toggle incoming batch selection
  const toggleIncomingBatch = useCallback((incoming: IncomingBatch) => {
    const batchEntryId = `incoming-${incoming.id}`;

    setSelectedIncomingIds((prev) => {
      const next = new Set(prev);
      if (next.has(incoming.id)) {
        next.delete(incoming.id);
        // Remove from batches
        setBatches((b) => b.filter((batch) => batch.id !== batchEntryId));
      } else {
        next.add(incoming.id);
        // Add to batches only if not already present
        setBatches((b) => {
          // Check if already exists to prevent duplicates
          if (b.some((batch) => batch.id === batchEntryId)) {
            return b;
          }

          const variety = varieties.find((v) => v.id === incoming.varietyId);
          const size = sizes.find((s) => s.id === incoming.sizeId);
          const location = locations.find((l) => l.id === incoming.locationId);

          const entry: BatchEntry = {
            id: batchEntryId,
            incomingBatchId: incoming.id,
            varietyId: incoming.varietyId ?? '',
            varietyName: incoming.varietyName ?? variety?.name ?? 'Unknown',
            varietyFamily: variety?.family ?? null,
            sizeId: incoming.sizeId ?? '',
            sizeName: incoming.sizeName ?? size?.name ?? 'Unknown',
            cellMultiple: size?.cell_multiple ?? 1,
            quantity: incoming.quantity,
            locationId: incoming.locationId ?? locations[0]?.id ?? '',
            locationName: incoming.locationName ?? location?.name ?? locations[0]?.name ?? '',
            isFromPlanned: true,
            plannedQuantity: incoming.quantity,
          };
          return [...b, entry];
        });
      }
      return next;
    });
  }, [varieties, sizes, locations]);

  // Add manual batch
  const handleAddBatch = useCallback(() => {
    if (!newVarietyId || !newSizeId || !newQuantity || !newLocationId) return;

    const variety = varieties.find((v) => v.id === newVarietyId);
    const size = sizes.find((s) => s.id === newSizeId);
    const location = locations.find((l) => l.id === newLocationId);

    const entry: BatchEntry = {
      id: `manual-${Date.now()}`,
      varietyId: newVarietyId,
      varietyName: variety?.name ?? 'Unknown',
      varietyFamily: variety?.family ?? null,
      sizeId: newSizeId,
      sizeName: size?.name ?? 'Unknown',
      cellMultiple: size?.cell_multiple ?? 1,
      quantity: newQuantity,
      locationId: newLocationId,
      locationName: location?.name ?? '',
      isFromPlanned: false,
    };

    setBatches((b) => [...b, entry]);
    // Reset form
    setNewVarietyId('');
    setNewSizeId('');
    setNewQuantity(0);
    setShowAddForm(false);
  }, [newVarietyId, newSizeId, newQuantity, newLocationId, varieties, sizes, locations]);

  // Remove batch
  const removeBatch = useCallback((batchId: string, incomingBatchId?: string) => {
    setBatches((b) => b.filter((batch) => batch.id !== batchId));
    if (incomingBatchId) {
      setSelectedIncomingIds((prev) => {
        const next = new Set(prev);
        next.delete(incomingBatchId);
        return next;
      });
    }
  }, []);

  // Update batch quantity
  const updateBatchQuantity = useCallback((batchId: string, quantity: number) => {
    setBatches((b) =>
      b.map((batch) =>
        batch.id === batchId ? { ...batch, quantity: Math.max(0, quantity) } : batch
      )
    );
  }, []);

  // Update batch location
  const updateBatchLocation = useCallback((batchId: string, locationId: string) => {
    const location = locations.find((l) => l.id === locationId);
    setBatches((b) =>
      b.map((batch) =>
        batch.id === batchId
          ? { ...batch, locationId, locationName: location?.name ?? '' }
          : batch
      )
    );
  }, [locations]);

  const isValid = batches.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onComplete({ batches });
  };

  const totalUnits = batches.reduce((sum, b) => sum + b.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Summary Badge */}
      <div className="flex items-center gap-4">
        <Badge variant={batches.length > 0 ? 'default' : 'secondary'} className="text-sm">
          {batches.length} batch{batches.length !== 1 ? 'es' : ''} · {totalUnits.toLocaleString()} units
        </Badge>
        <span className="text-sm text-muted-foreground">
          from {supplierData.supplierName}
        </span>
      </div>

      {/* Planned Incoming Batches */}
      {filteredIncoming.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Planned Incoming Batches
            </CardTitle>
            <CardDescription>
              Select batches that match this delivery. Adjust quantities if needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredIncoming.map((incoming) => {
              const isSelected = selectedIncomingIds.has(incoming.id);
              return (
                <div
                  key={incoming.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  )}
                  onClick={() => toggleIncomingBatch(incoming)}
                >
                  <Checkbox checked={isSelected} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {incoming.varietyName ?? 'Unknown variety'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {incoming.sizeName} · {incoming.quantity.toLocaleString()} units expected
                    </div>
                  </div>
                  {incoming.batchNumber && (
                    <Badge variant="outline" className="shrink-0">
                      #{incoming.batchNumber}
                    </Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Selected/Added Batches Table */}
      {batches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Batches to Check In</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variety</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="w-[120px]">Quantity</TableHead>
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
                      {batch.isFromPlanned && (
                        <Badge variant="secondary" className="text-xs mt-1">Planned</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{batch.sizeName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={batch.quantity}
                        onChange={(e) => updateBatchQuantity(batch.id, parseInt(e.target.value) || 0)}
                        className="w-24 h-8"
                      />
                      {batch.isFromPlanned && batch.plannedQuantity !== batch.quantity && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Expected: {batch.plannedQuantity?.toLocaleString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={batch.locationId}
                        onValueChange={(v) => updateBatchLocation(batch.id, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeBatch(batch.id, batch.incomingBatchId)}
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

      {/* Add New Batch */}
      {!showAddForm ? (
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Batch Manually
        </Button>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sprout className="h-4 w-4" />
              Add New Batch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Variety */}
              <div className="space-y-2">
                <Label>Variety</Label>
                <Popover open={varietyOpen} onOpenChange={setVarietyOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedVariety ? (
                        <span>
                          {selectedVariety.name}
                          {selectedVariety.family && ` (${selectedVariety.family})`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Select variety...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search varieties..." />
                      <CommandList>
                        <CommandEmpty>No variety found.</CommandEmpty>
                        <CommandGroup>
                          {varieties.map((v) => (
                            <CommandItem
                              key={v.id}
                              value={v.name}
                              onSelect={() => {
                                setNewVarietyId(v.id);
                                setVarietyOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  newVarietyId === v.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {v.name}
                              {v.family && (
                                <span className="text-muted-foreground ml-1">({v.family})</span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Size */}
              <div className="space-y-2">
                <Label>Size</Label>
                <Popover open={sizeOpen} onOpenChange={setSizeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedSize ? (
                        <span>{selectedSize.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Select size...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search sizes..." />
                      <CommandList>
                        <CommandEmpty>No size found.</CommandEmpty>
                        <CommandGroup>
                          {sizes.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={s.name}
                              onSelect={() => {
                                setNewSizeId(s.id);
                                setSizeOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  newSizeId === s.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label>Quantity (units)</Label>
                <Input
                  type="number"
                  min={1}
                  value={newQuantity || ''}
                  onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity"
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label>Location</Label>
                <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedLocation ? (
                        <span>{selectedLocation.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Select location...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search locations..." />
                      <CommandList>
                        <CommandEmpty>No location found.</CommandEmpty>
                        <CommandGroup>
                          {locations.map((l) => (
                            <CommandItem
                              key={l.id}
                              value={l.name}
                              onSelect={() => {
                                setNewLocationId(l.id);
                                setLocationOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  newLocationId === l.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {l.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddBatch}
                disabled={!newVarietyId || !newSizeId || !newQuantity || !newLocationId}
              >
                Add Batch
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {batches.length === 0 && filteredIncoming.length === 0 && !showAddForm && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No planned incoming batches found for this supplier.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Add batches manually using the button above.
            </p>
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
          Next: Quality Check
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
