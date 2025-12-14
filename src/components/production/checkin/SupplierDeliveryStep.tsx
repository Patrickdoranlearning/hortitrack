'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Check, ChevronsUpDown, ChevronRight, Truck, Calendar, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReferenceData } from '@/contexts/ReferenceDataContext';

export type SupplierDeliveryData = {
  supplierId: string;
  supplierName: string;
  supplierProducerCode: string | null;
  supplierCountryCode: string | null;
  deliveryDate: string;
  supplierReference: string;
};

type SupplierDeliveryStepProps = {
  referenceData: ReferenceData;
  initialData: SupplierDeliveryData | null;
  onComplete: (data: SupplierDeliveryData) => void;
  onCancel?: () => void;
};

export function SupplierDeliveryStep({
  referenceData,
  initialData,
  onComplete,
  onCancel,
}: SupplierDeliveryStepProps) {
  const [supplierId, setSupplierId] = useState(initialData?.supplierId ?? '');
  const [deliveryDate, setDeliveryDate] = useState(
    initialData?.deliveryDate ?? new Date().toISOString().slice(0, 10)
  );
  const [supplierReference, setSupplierReference] = useState(initialData?.supplierReference ?? '');
  const [supplierOpen, setSupplierOpen] = useState(false);

  const suppliers = referenceData.suppliers ?? [];

  // Debug logging for suppliers
  useEffect(() => {
    console.log('[SupplierDeliveryStep] referenceData:', referenceData);
    console.log('[SupplierDeliveryStep] suppliers:', suppliers);
  }, [referenceData, suppliers]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId),
    [suppliers, supplierId]
  );

  // Validation - supplier and date are required
  const isValid = supplierId && deliveryDate;

  const handleSubmit = () => {
    if (!isValid || !selectedSupplier) return;

    onComplete({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      supplierProducerCode: selectedSupplier.producer_code ?? null,
      supplierCountryCode: selectedSupplier.country_code ?? null,
      deliveryDate,
      supplierReference,
    });
  };

  // Readiness indicators
  const readiness = [
    { label: 'Supplier', ok: !!supplierId },
    { label: 'Delivery Date', ok: !!deliveryDate },
    { label: 'Reference', ok: !!supplierReference, optional: true },
  ];

  return (
    <div className="space-y-6">
      {/* No Suppliers Warning */}
      {suppliers.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">No suppliers configured</p>
                <p className="text-sm text-amber-700 mt-1">
                  You need to add suppliers before checking in stock.{' '}
                  <a href="/suppliers" className="underline font-medium hover:text-amber-800">
                    Add your first supplier →
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Supplier Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Supplier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={supplierOpen}
                className="w-full justify-between h-12"
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
                  <span className="text-muted-foreground">Select supplier...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search suppliers..." />
                <CommandList>
                  <CommandEmpty>
                    {suppliers.length === 0 ? (
                      <div className="py-6 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">No suppliers configured</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <a href="/suppliers" className="underline hover:text-primary">
                            Add your first supplier →
                          </a>
                        </p>
                      </div>
                    ) : (
                      'No matching supplier found.'
                    )}
                  </CommandEmpty>
                  <CommandGroup>
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
                          <span className="font-medium">{supplier.name}</span>
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
        </CardContent>
      </Card>

      {/* Delivery Date & Reference */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Delivery Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="h-12"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Supplier Reference
              <Badge variant="outline" className="font-normal text-xs">Optional</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Delivery note / PO number..."
              value={supplierReference}
              onChange={(e) => setSupplierReference(e.target.value)}
              className="h-12"
            />
          </CardContent>
        </Card>
      </div>

      {/* Supplier Info Card */}
      {selectedSupplier && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Producer Code</span>
                <span className="font-medium">{selectedSupplier.producer_code || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country</span>
                <span className="font-medium">{selectedSupplier.country_code || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
          Next: Select Batches
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
