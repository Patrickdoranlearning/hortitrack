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
  Check,
  ChevronsUpDown,
  ChevronRight,
  ChevronLeft,
  ArrowRightLeft,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReferenceData } from '@/contexts/ReferenceDataContext';
import type { SourceBatch } from './SelectSourceBatchesStep';

export type PlannedTransplantEntry = {
  id: string;
  sourceBatchId: string;
  sourceBatchNumber: string;
  varietyName: string;
  varietyFamily: string | null;
  targetSizeId: string;
  targetSizeName: string;
  quantity: number;
  maxQuantity: number;
  locationId?: string;
  locationName?: string;
  notes?: string;
};

export type ConfigureTransplantsStepData = {
  transplants: PlannedTransplantEntry[];
};

type ConfigureTransplantsStepProps = {
  referenceData: ReferenceData;
  selectedBatches: SourceBatch[];
  initialData: ConfigureTransplantsStepData | null;
  onComplete: (data: ConfigureTransplantsStepData) => void;
  onBack: () => void;
};

export function ConfigureTransplantsStep({
  referenceData,
  selectedBatches,
  initialData,
  onComplete,
  onBack,
}: ConfigureTransplantsStepProps) {
  // Initialize transplants from selected batches
  const [transplants, setTransplants] = useState<PlannedTransplantEntry[]>(() => {
    if (initialData?.transplants) return initialData.transplants;

    // Create one transplant entry per source batch
    return selectedBatches.map((batch) => ({
      id: `trans-${batch.id}`,
      sourceBatchId: batch.id,
      sourceBatchNumber: batch.batchNumber,
      varietyName: batch.varietyName,
      varietyFamily: batch.varietyFamily,
      targetSizeId: '',
      targetSizeName: '',
      quantity: batch.availableQuantity,
      maxQuantity: batch.availableQuantity,
      locationId: undefined,
      locationName: undefined,
      notes: undefined,
    }));
  });

  // Pot sizes for transplanting (filter out tray sizes)
  const potSizes = useMemo(() => {
    return (referenceData.sizes ?? []).filter(
      (s) => s.container_type === 'pot' || (!s.cell_multiple || s.cell_multiple === 1)
    );
  }, [referenceData.sizes]);

  const locations = referenceData.locations ?? [];

  // Track which popovers are open
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

  const togglePopover = useCallback((key: string, open: boolean) => {
    setOpenPopovers((prev) => ({ ...prev, [key]: open }));
  }, []);

  // Update transplant field
  const updateTransplant = useCallback((id: string, field: string, value: any) => {
    setTransplants((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;

        if (field === 'targetSizeId') {
          const size = potSizes.find((s) => s.id === value);
          return { ...t, targetSizeId: value, targetSizeName: size?.name ?? '' };
        }

        if (field === 'locationId') {
          const location = locations.find((l) => l.id === value);
          return { ...t, locationId: value || undefined, locationName: location?.name };
        }

        if (field === 'quantity') {
          const qty = Math.max(1, Math.min(value, t.maxQuantity));
          return { ...t, quantity: qty };
        }

        return { ...t, [field]: value };
      })
    );
  }, [potSizes, locations]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: Record<string, string[]> = {};

    transplants.forEach((t) => {
      const tErrors: string[] = [];
      if (!t.targetSizeId) tErrors.push('Target size required');
      if (t.quantity <= 0) tErrors.push('Quantity must be > 0');
      if (t.quantity > t.maxQuantity) tErrors.push(`Max ${t.maxQuantity} available`);
      if (tErrors.length > 0) errors[t.id] = tErrors;
    });

    return errors;
  }, [transplants]);

  const isValid = Object.keys(validationErrors).length === 0 && transplants.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onComplete({ transplants });
  };

  const totalQuantity = transplants.reduce((sum, t) => sum + t.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <Badge variant="default" className="text-sm">
          {transplants.length} transplant{transplants.length !== 1 ? 's' : ''} · {totalQuantity.toLocaleString()} units
        </Badge>
      </div>

      {/* Transplant Configuration Cards */}
      <div className="space-y-4">
        {transplants.map((transplant) => {
          const hasErrors = validationErrors[transplant.id]?.length > 0;
          const sizePopoverKey = `size-${transplant.id}`;
          const locationPopoverKey = `loc-${transplant.id}`;

          return (
            <Card
              key={transplant.id}
              className={cn(hasErrors && 'border-destructive/50')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  <span className="font-mono">{transplant.sourceBatchNumber}</span>
                  <span className="text-muted-foreground font-normal">
                    · {transplant.varietyName}
                  </span>
                  {transplant.varietyFamily && (
                    <span className="text-muted-foreground font-normal">
                      ({transplant.varietyFamily})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Target Size */}
                  <div className="space-y-2">
                    <Label>Target Pot Size *</Label>
                    <Popover
                      open={openPopovers[sizePopoverKey]}
                      onOpenChange={(open) => togglePopover(sizePopoverKey, open)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between',
                            !transplant.targetSizeId && 'text-muted-foreground'
                          )}
                        >
                          {transplant.targetSizeName || 'Select pot size...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search sizes..." />
                          <CommandList>
                            <CommandEmpty>No pot size found.</CommandEmpty>
                            <CommandGroup>
                              {potSizes.map((s) => (
                                <CommandItem
                                  key={s.id}
                                  value={s.name}
                                  onSelect={() => {
                                    updateTransplant(transplant.id, 'targetSizeId', s.id);
                                    togglePopover(sizePopoverKey, false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      transplant.targetSizeId === s.id ? 'opacity-100' : 'opacity-0'
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
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      min={1}
                      max={transplant.maxQuantity}
                      value={transplant.quantity}
                      onChange={(e) =>
                        updateTransplant(transplant.id, 'quantity', parseInt(e.target.value) || 0)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Max: {transplant.maxQuantity.toLocaleString()} available
                    </p>
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <Label>
                      Location
                      <Badge variant="outline" className="ml-2 font-normal text-xs">Optional</Badge>
                    </Label>
                    <Popover
                      open={openPopovers[locationPopoverKey]}
                      onOpenChange={(open) => togglePopover(locationPopoverKey, open)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between',
                            !transplant.locationId && 'text-muted-foreground'
                          )}
                        >
                          {transplant.locationName || 'TBD'}
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
                                  updateTransplant(transplant.id, 'locationId', '');
                                  togglePopover(locationPopoverKey, false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    !transplant.locationId ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <span className="text-muted-foreground">TBD</span>
                              </CommandItem>
                              {locations.map((l) => (
                                <CommandItem
                                  key={l.id}
                                  value={l.name}
                                  onSelect={() => {
                                    updateTransplant(transplant.id, 'locationId', l.id);
                                    togglePopover(locationPopoverKey, false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      transplant.locationId === l.id ? 'opacity-100' : 'opacity-0'
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

                {/* Notes */}
                <div className="space-y-2">
                  <Label>
                    Notes
                    <Badge variant="outline" className="ml-2 font-normal text-xs">Optional</Badge>
                  </Label>
                  <Textarea
                    value={transplant.notes ?? ''}
                    onChange={(e) => updateTransplant(transplant.id, 'notes', e.target.value)}
                    placeholder="Any special instructions..."
                    rows={2}
                  />
                </div>

                {/* Validation Errors */}
                {hasErrors && (
                  <div className="flex items-start gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>{validationErrors[transplant.id].join(', ')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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
