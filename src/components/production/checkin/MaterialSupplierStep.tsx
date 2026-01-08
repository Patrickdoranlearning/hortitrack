'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Check, ChevronsUpDown, ChevronRight, X, Sprout, Ruler, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReferenceData } from '@/contexts/ReferenceDataContext';

export type MaterialSupplierData = {
  varietyId: string;
  varietyName: string;
  varietyFamily: string | null;
  sizeId: string;
  sizeName: string;
  cellMultiple: number;
  phase: 'propagation' | 'plug' | 'potted';
  supplierId: string | null;
  supplierName: string | null;
  supplierProducerCode: string | null;
  supplierCountryCode: string | null;
};

type MaterialSupplierStepProps = {
  referenceData: ReferenceData;
  initialData: MaterialSupplierData | null;
  onComplete: (data: MaterialSupplierData) => void;
  onCancel?: () => void;
};

const PHASE_OPTIONS = [
  { value: 'propagation', label: 'Propagation' },
  { value: 'plug', label: 'Plug / Liner' },
  { value: 'potted', label: 'Potted' },
] as const;

const OPTIONAL_VALUE = '__none__';

export function MaterialSupplierStep({
  referenceData,
  initialData,
  onComplete,
  onCancel,
}: MaterialSupplierStepProps) {
  const [varietyId, setVarietyId] = useState(initialData?.varietyId ?? '');
  const [sizeId, setSizeId] = useState(initialData?.sizeId ?? '');
  const [phase, setPhase] = useState<'propagation' | 'plug' | 'potted'>(
    initialData?.phase ?? 'propagation'
  );
  const [supplierId, setSupplierId] = useState(initialData?.supplierId ?? '');

  const [varietyOpen, setVarietyOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);

  const varieties = referenceData.varieties ?? [];
  const sizes = referenceData.sizes ?? [];
  const suppliers = referenceData.suppliers ?? [];

  // Find selected items
  const selectedVariety = useMemo(
    () => varieties.find((v) => v.id === varietyId),
    [varieties, varietyId]
  );
  const selectedSize = useMemo(
    () => sizes.find((s) => s.id === sizeId),
    [sizes, sizeId]
  );
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId),
    [suppliers, supplierId]
  );

  // Validation
  const isValid = varietyId && sizeId && phase;

  const handleSubmit = () => {
    if (!isValid || !selectedVariety || !selectedSize) return;

    onComplete({
      varietyId: selectedVariety.id,
      varietyName: selectedVariety.name,
      varietyFamily: selectedVariety.family ?? null,
      sizeId: selectedSize.id,
      sizeName: selectedSize.name,
      cellMultiple: selectedSize.cell_multiple ?? 1,
      phase,
      supplierId: selectedSupplier?.id ?? null,
      supplierName: selectedSupplier?.name ?? null,
      supplierProducerCode: selectedSupplier?.producer_code ?? null,
      supplierCountryCode: selectedSupplier?.country_code ?? null,
    });
  };

  // Readiness indicators
  const readiness = [
    { label: 'Variety', ok: !!varietyId },
    { label: 'Size', ok: !!sizeId },
    { label: 'Phase', ok: !!phase },
    { label: 'Supplier', ok: !!supplierId, optional: true },
  ];

  return (
    <div className="space-y-6">
      {/* Completion Status */}
      <div className="flex flex-wrap gap-2">
        {readiness.map((item) => (
          <Badge
            key={item.label}
            variant={item.ok ? 'default' : 'secondary'}
            className={cn(
              item.ok ? 'bg-green-100 text-green-700' : 'bg-muted',
              item.optional && !item.ok && 'opacity-60'
            )}
          >
            {item.ok && <Check className="h-3 w-3 mr-1" />}
            {item.label}
            {item.optional && !item.ok && ' (optional)'}
          </Badge>
        ))}
      </div>

      {/* Variety Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sprout className="h-4 w-4" />
            Variety
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={varietyOpen} onOpenChange={setVarietyOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={varietyOpen}
                className="w-full justify-between h-12"
              >
                {selectedVariety ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedVariety.name}</span>
                    {selectedVariety.family && (
                      <span className="text-muted-foreground">· {selectedVariety.family}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select a variety...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search varieties..." />
                <CommandList>
                  <CommandEmpty>No variety found.</CommandEmpty>
                  <CommandGroup>
                    {varieties.map((variety) => (
                      <CommandItem
                        key={variety.id}
                        value={variety.name}
                        onSelect={() => {
                          setVarietyId(variety.id);
                          setVarietyOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            varietyId === variety.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div>
                          <span className="font-medium">{variety.name}</span>
                          {variety.family && (
                            <span className="text-muted-foreground ml-2">· {variety.family}</span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Size & Phase */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Size / Container
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Popover open={sizeOpen} onOpenChange={setSizeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={sizeOpen}
                  className="w-full justify-between h-12"
                >
                  {selectedSize ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedSize.name}</span>
                      {selectedSize.cell_multiple && selectedSize.cell_multiple > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedSize.cell_multiple} cells
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select a size...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search sizes..." />
                  <CommandList>
                    <CommandEmpty>No size found.</CommandEmpty>
                    <CommandGroup>
                      {sizes.map((size) => (
                        <CommandItem
                          key={size.id}
                          value={size.name}
                          onSelect={() => {
                            setSizeId(size.id);
                            setSizeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              sizeId === size.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex items-center gap-2">
                            <span>{size.name}</span>
                            {size.cell_multiple && size.cell_multiple > 1 && (
                              <Badge variant="outline" className="text-xs">
                                ×{size.cell_multiple}
                              </Badge>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ready Phase</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={phase} onValueChange={(v) => setPhase(v as typeof phase)}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select phase" />
              </SelectTrigger>
              <SelectContent>
                {PHASE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Supplier */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Supplier
            <Badge variant="outline" className="font-normal">Optional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={supplierOpen}
                  className="flex-1 justify-between h-12"
                >
                  {selectedSupplier ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedSupplier.name}</span>
                      {selectedSupplier.producer_code && (
                        <span className="text-muted-foreground">
                          · {selectedSupplier.producer_code}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select a supplier...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search suppliers..." />
                  <CommandList>
                    <CommandEmpty>No supplier found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value={OPTIONAL_VALUE}
                        onSelect={() => {
                          setSupplierId('');
                          setSupplierOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            !supplierId ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span className="text-muted-foreground">No supplier</span>
                      </CommandItem>
                      {suppliers.map((supplier) => (
                        <CommandItem
                          key={supplier.id}
                          value={supplier.name}
                          onSelect={() => {
                            setSupplierId(supplier.id);
                            setSupplierOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              supplierId === supplier.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div>
                            <span>{supplier.name}</span>
                            {supplier.producer_code && (
                              <span className="text-muted-foreground ml-2">
                                · {supplier.producer_code}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {supplierId && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-12 w-12"
                onClick={() => setSupplierId('')}
              >
                <X className="h-4 w-4" />
              </Button>
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
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
