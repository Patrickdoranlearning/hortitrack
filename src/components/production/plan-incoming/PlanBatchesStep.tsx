'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Sprout,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [newLocationId, setNewLocationId] = useState('');
  const [newNotes, setNewNotes] = useState('');
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

  // Add planned batch
  const handleAddBatch = useCallback(() => {
    if (!newVarietyId || !newSizeId || !newQuantity) return;

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
      expectedQuantity: newQuantity,
      locationId: newLocationId || undefined,
      locationName: location?.name,
      notes: newNotes || undefined,
    };

    setBatches((b) => [...b, entry]);
    // Reset form but keep it open for adding more
    setNewVarietyId('');
    setNewSizeId('');
    setNewQuantity(0);
    setNewLocationId('');
    setNewNotes('');
  }, [newVarietyId, newSizeId, newQuantity, newLocationId, newNotes, varieties, sizes, locations]);

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
  const updateBatchLocation = useCallback((batchId: string, locationId: string) => {
    const location = locations.find((l) => l.id === locationId);
    setBatches((b) =>
      b.map((batch) =>
        batch.id === batchId
          ? { ...batch, locationId: locationId || undefined, locationName: location?.name }
          : batch
      )
    );
  }, [locations]);

  const isValid = batches.length > 0;
  const canAddBatch = newVarietyId && newSizeId && newQuantity > 0;

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
                        value={batch.locationId ?? ''}
                        onValueChange={(v) => updateBatchLocation(batch.id, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="TBD" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">TBD</SelectItem>
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
                <Label>Size *</Label>
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
                <Label>Expected Quantity *</Label>
                <Input
                  type="number"
                  min={1}
                  value={newQuantity || ''}
                  onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Enter expected quantity"
                />
              </div>

              {/* Location (Optional) */}
              <div className="space-y-2">
                <Label>
                  Location
                  <Badge variant="outline" className="ml-2 font-normal text-xs">Optional</Badge>
                </Label>
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
                        <span className="text-muted-foreground">Select location (or leave TBD)...</span>
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
                          <CommandItem
                            value="none"
                            onSelect={() => {
                              setNewLocationId('');
                              setLocationOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                !newLocationId ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="text-muted-foreground">TBD (decide at check-in)</span>
                          </CommandItem>
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
