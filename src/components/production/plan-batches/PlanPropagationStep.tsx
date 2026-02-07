'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
  Check,
  ChevronsUpDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Sprout,
  Calendar,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReferenceData } from '@/contexts/ReferenceDataContext';
import { useTodayDate } from '@/lib/date-sync';

export type PlannedPropagationEntry = {
  id: string;
  varietyId: string;
  varietyName: string;
  varietyFamily: string | null;
  sizeId: string;
  sizeName: string;
  expectedQuantity: number;
  locationId?: string;
  locationName?: string;
  notes?: string;
};

export type PlanPropagationStepData = {
  plannedDate: string;
  batches: PlannedPropagationEntry[];
};

type PlanPropagationStepProps = {
  referenceData: ReferenceData;
  initialData: PlanPropagationStepData | null;
  onComplete: (data: PlanPropagationStepData) => void;
  onBack: () => void;
};

export function PlanPropagationStep({
  referenceData,
  initialData,
  onComplete,
  onBack,
}: PlanPropagationStepProps) {
  // Use hydration-safe date to prevent server/client mismatch
  const today = useTodayDate();
  const [plannedDate, setPlannedDate] = useState(initialData?.plannedDate ?? '');
  const [batches, setBatches] = useState<PlannedPropagationEntry[]>(initialData?.batches ?? []);

  // Set date after hydration if not provided
  useEffect(() => {
    if (today && !plannedDate && !initialData?.plannedDate) {
      setPlannedDate(today);
    }
  }, [today, plannedDate, initialData?.plannedDate]);

  // New batch form state
  const [showAddForm, setShowAddForm] = useState(batches.length === 0);
  const [newVarietyId, setNewVarietyId] = useState('');
  const [newSizeId, setNewSizeId] = useState('');
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [newLocationId, setNewLocationId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [varietyOpen, setVarietyOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  const varieties = referenceData.varieties ?? [];
  const sizes = useMemo(() => {
    // Filter to only tray sizes for propagation
    return (referenceData.sizes ?? []).filter(
      (s) => s.container_type === 'tray' || (s.cell_multiple && s.cell_multiple > 1)
    );
  }, [referenceData.sizes]);
  const locations = referenceData.locations ?? [];

  const selectedVariety = useMemo(
    () => varieties.find((v) => v.id === newVarietyId),
    [varieties, newVarietyId]
  );
  const selectedSize = useMemo(
    () => sizes.find((s) => s.id === newSizeId),
    [sizes, newSizeId]
  );
  // Add planned batch
  const handleAddBatch = useCallback(() => {
    if (!newVarietyId || !newSizeId || !newQuantity) return;

    const variety = varieties.find((v) => v.id === newVarietyId);
    const size = sizes.find((s) => s.id === newSizeId);
    const location = newLocationId ? locations.find((l) => l.id === newLocationId) : null;

    // Calculate total plants from trays × cells
    const totalPlants = size?.cell_multiple ? newQuantity * size.cell_multiple : newQuantity;

    const entry: PlannedPropagationEntry = {
      id: `prop-${Date.now()}`,
      varietyId: newVarietyId,
      varietyName: variety?.name ?? 'Unknown',
      varietyFamily: variety?.family ?? null,
      sizeId: newSizeId,
      sizeName: size?.name ?? 'Unknown',
      expectedQuantity: totalPlants,
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

  const isValid = batches.length > 0 && plannedDate;
  const canAddBatch = newVarietyId && newSizeId && newQuantity > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onComplete({ plannedDate, batches });
  };

  const totalUnits = batches.reduce((sum, b) => sum + b.expectedQuantity, 0);

  return (
    <div className="space-y-6">
      {/* Planned Date */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Planned Date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
            className="h-12 max-w-xs"
          />
          <p className="text-sm text-muted-foreground mt-2">
            When do you plan to start these propagation batches?
          </p>
        </CardContent>
      </Card>

      {/* Summary Badge */}
      <div className="flex items-center gap-4">
        <Badge variant={batches.length > 0 ? 'default' : 'secondary'} className="text-sm">
          {batches.length} batch{batches.length !== 1 ? 'es' : ''} · {totalUnits.toLocaleString()} units
        </Badge>
      </div>

      {/* Added Batches Table */}
      {batches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Planned Propagation Batches
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variety</TableHead>
                  <TableHead>Tray Size</TableHead>
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
                      <LocationComboboxGrouped
                        locations={locations.map((loc) => ({
                          id: loc.id,
                          name: loc.name,
                          nursery_site: loc.nursery_site ?? '',
                          is_virtual: loc.is_virtual ?? false,
                        }))}
                        value={batch.locationId ?? ''}
                        onSelect={(v) => updateBatchLocation(batch.id, v)}
                        createHref="/locations"
                        placeholder="TBD"
                        createLabel="Add new location"
                        emptyLabel="TBD"
                        emptyValue=""
                        excludeVirtual
                        triggerClassName="h-8"
                      />
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
              {batches.length === 0 ? 'Add Propagation Batch' : 'Add Another Batch'}
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

              {/* Tray Size */}
              <div className="space-y-2">
                <Label>Tray Size *</Label>
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
                        <span className="text-muted-foreground">Select tray size...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search sizes..." />
                      <CommandList>
                        <CommandEmpty>No tray size found.</CommandEmpty>
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
                              {s.cell_multiple && (
                                <span className="text-muted-foreground ml-1">
                                  ({s.cell_multiple} cells)
                                </span>
                              )}
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
                <Label>Quantity (trays) *</Label>
                <Input
                  type="number"
                  min={1}
                  value={newQuantity || ''}
                  onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Enter number of trays"
                />
                {selectedSize && newQuantity > 0 && selectedSize.cell_multiple && (
                  <p className="text-sm text-muted-foreground">
                    = <span className="font-medium text-foreground">{(newQuantity * selectedSize.cell_multiple).toLocaleString()}</span> plants
                    <span className="text-xs ml-1">({newQuantity} × {selectedSize.cell_multiple} cells)</span>
                  </p>
                )}
              </div>

              {/* Location (Optional) */}
              <div className="space-y-2">
                <Label>
                  Location
                  <Badge variant="outline" className="ml-2 font-normal text-xs">Optional</Badge>
                </Label>
                <LocationComboboxGrouped
                  locations={locations.map((loc) => ({
                    id: loc.id,
                    name: loc.name,
                    nursery_site: loc.nursery_site ?? '',
                    is_virtual: loc.is_virtual ?? false,
                  }))}
                  value={newLocationId}
                  onSelect={(v) => setNewLocationId(v)}
                  createHref="/locations"
                  placeholder="Select location..."
                  createLabel="Add new location"
                  emptyLabel="TBD"
                  emptyValue=""
                  excludeVirtual
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
                placeholder="Any special instructions..."
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
