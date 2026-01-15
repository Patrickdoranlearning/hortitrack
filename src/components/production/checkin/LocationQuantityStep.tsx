'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Check, ChevronsUpDown, ChevronLeft, ChevronRight, MapPin, Calendar, Package, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReferenceData } from '@/contexts/ReferenceDataContext';
import type { MaterialSupplierData } from './MaterialSupplierStep';
import { useTodayDate } from '@/lib/date-sync';

export type LocationQuantityData = {
  locationId: string;
  locationName: string;
  incomingDate: string;
  containers: number;
  totalUnits: number;
  supplierBatchNumber: string;
};

type LocationQuantityStepProps = {
  referenceData: ReferenceData;
  materialData: MaterialSupplierData;
  initialData: LocationQuantityData | null;
  onComplete: (data: LocationQuantityData) => void;
  onBack: () => void;
};

export function LocationQuantityStep({
  referenceData,
  materialData,
  initialData,
  onComplete,
  onBack,
}: LocationQuantityStepProps) {
  // Use hydration-safe date to prevent server/client mismatch
  const today = useTodayDate();
  const [locationId, setLocationId] = useState(initialData?.locationId ?? '');
  const [incomingDate, setIncomingDate] = useState(initialData?.incomingDate ?? '');
  const [containers, setContainers] = useState(initialData?.containers ?? 1);
  const [supplierBatchNumber, setSupplierBatchNumber] = useState(
    initialData?.supplierBatchNumber ?? ''
  );

  // Set date after hydration if not provided
  useEffect(() => {
    if (today && !incomingDate && !initialData?.incomingDate) {
      setIncomingDate(today);
    }
  }, [today, incomingDate, initialData?.incomingDate]);

  const [locationOpen, setLocationOpen] = useState(false);

  const locations = referenceData.locations ?? [];

  // Find selected location
  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId]
  );

  // Calculate total units from containers and cell multiple
  const cellMultiple = materialData.cellMultiple ?? 1;
  const totalUnits = containers * cellMultiple;

  // Estimate ready date (21 days from incoming)
  const estimatedReadyDate = useMemo(() => {
    if (!incomingDate) return null;
    const date = new Date(incomingDate);
    date.setDate(date.getDate() + 21);
    return date.toISOString().slice(0, 10);
  }, [incomingDate]);

  // Validation
  const isValid = locationId && incomingDate && containers > 0 && supplierBatchNumber.trim().length > 0;

  // Readiness indicators
  const readiness = [
    { label: 'Location', ok: !!locationId },
    { label: 'Date', ok: !!incomingDate },
    { label: 'Containers', ok: containers > 0 },
    { label: 'Supplier Batch', ok: supplierBatchNumber.trim().length > 0 },
  ];

  const handleSubmit = () => {
    if (!isValid || !selectedLocation) return;

    onComplete({
      locationId: selectedLocation.id,
      locationName: selectedLocation.name,
      incomingDate,
      containers,
      totalUnits,
      supplierBatchNumber: supplierBatchNumber.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Completion Status */}
      <div className="flex flex-wrap gap-2">
        {readiness.map((item) => (
          <Badge
            key={item.label}
            variant={item.ok ? 'default' : 'secondary'}
            className={cn(item.ok ? 'bg-green-100 text-green-700' : 'bg-muted')}
          >
            {item.ok && <Check className="h-3 w-3 mr-1" />}
            {item.label}
          </Badge>
        ))}
      </div>

      {/* Material Summary */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{materialData.varietyName}</p>
              <p className="text-sm text-muted-foreground">
                {materialData.sizeName}
                {cellMultiple > 1 && ` (×${cellMultiple} cells)`}
                {materialData.supplierName && ` · ${materialData.supplierName}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Nursery Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={locationOpen} onOpenChange={setLocationOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={locationOpen}
                className="w-full justify-between h-12"
              >
                {selectedLocation ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedLocation.name}</span>
                    {selectedLocation.nursery_site && (
                      <span className="text-muted-foreground">
                        · {selectedLocation.nursery_site}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select a location...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search locations..." />
                <CommandList>
                  <CommandEmpty>No location found.</CommandEmpty>
                  <CommandGroup>
                    {locations.map((location) => (
                      <CommandItem
                        key={location.id}
                        value={location.name}
                        onSelect={() => {
                          setLocationId(location.id);
                          setLocationOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            locationId === location.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div>
                          <span>{location.name}</span>
                          {location.nursery_site && (
                            <span className="text-muted-foreground ml-2">
                              · {location.nursery_site}
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

      {/* Date & Quantities */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Incoming Date
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="date"
              value={incomingDate}
              onChange={(e) => setIncomingDate(e.target.value)}
              className="h-12"
            />
            {estimatedReadyDate && (
              <p className="text-sm text-muted-foreground">
                Est. ready: <span className="font-medium">{estimatedReadyDate}</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Containers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="number"
              min={1}
              value={containers}
              onChange={(e) => setContainers(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-12 text-lg font-medium"
            />
            {cellMultiple > 1 && (
              <p className="text-sm text-muted-foreground">
                {containers} × {cellMultiple} cells ={' '}
                <span className="font-medium text-primary">{totalUnits.toLocaleString()} units</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supplier Batch Number */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Supplier Batch / Traceability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="e.g. PO-2024-09-18"
            value={supplierBatchNumber}
            onChange={(e) => setSupplierBatchNumber(e.target.value)}
            className="h-12"
          />
          <p className="text-sm text-muted-foreground mt-2">
            Reference number from the supplier for traceability
          </p>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Containers</p>
              <p className="text-xl font-bold">{containers}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Total Units</p>
              <p className="text-xl font-bold text-primary">{totalUnits.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Phase</p>
              <p className="text-xl font-bold capitalize">{materialData.phase}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Incoming</p>
              <p className="text-xl font-bold">{incomingDate || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={!isValid}>
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
