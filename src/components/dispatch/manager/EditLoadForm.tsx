'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SelectWithCreate } from '@/components/ui/select-with-create';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DialogFooter } from '@/components/ui/dialog';
import type { ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import type { HaulierWithVehicles } from '@/lib/types';

interface EditLoadFormProps {
  load: ActiveDeliveryRunSummary;
  hauliers: HaulierWithVehicles[];
  onUpdate: (load: ActiveDeliveryRunSummary) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EditLoadForm({
  load,
  hauliers,
  onUpdate,
  onSave,
  onCancel,
}: EditLoadFormProps) {
  const selectedHaulierVehicles = useMemo(() => {
    if (!load.haulierId) return [];
    const haulier = hauliers.find((h) => h.id === load.haulierId);
    return haulier?.vehicles || [];
  }, [load.haulierId, hauliers]);

  return (
    <>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Load Name</Label>
          <Input
            value={load.loadName || ''}
            onChange={(e) => onUpdate({ ...load, loadName: e.target.value })}
            placeholder="e.g., Cork Load 1"
          />
        </div>
        <div className="space-y-2">
          <Label>Haulier</Label>
          <SelectWithCreate
            options={hauliers.map((h) => ({
              value: h.id!,
              label: h.name + (h.vehicles.length > 0 ? ` (${h.vehicles.length} vehicles)` : ''),
            }))}
            value={load.haulierId || ''}
            onValueChange={(v) =>
              onUpdate({ ...load, haulierId: v, vehicleId: undefined })
            }
            createHref="/hauliers"
            placeholder="Select haulier..."
            createLabel="Add new haulier"
          />
        </div>
        {selectedHaulierVehicles.length > 0 && (
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select
              value={load.vehicleId || ''}
              onValueChange={(v) => onUpdate({ ...load, vehicleId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle..." />
              </SelectTrigger>
              <SelectContent>
                {selectedHaulierVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id!}>
                    {v.name} ({v.trolleyCapacity} trolleys)
                    {v.registration && ` - ${v.registration}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {load.runDate
                  ? format(parseISO(load.runDate), 'PPP')
                  : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={load.runDate ? parseISO(load.runDate) : undefined}
                onSelect={(date) =>
                  date &&
                  onUpdate({
                    ...load,
                    runDate: format(date, 'yyyy-MM-dd'),
                  })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave}>Save Changes</Button>
      </DialogFooter>
    </>
  );
}
