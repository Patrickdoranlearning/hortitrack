'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HaulierVehicleSchema, TruckLayoutSchema, type HaulierVehicle, type TruckLayout, type Haulier } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const VehicleFormSchema = HaulierVehicleSchema.omit({ id: true, orgId: true }).extend({
  truckLayout: TruckLayoutSchema.optional(),
});
type VehicleFormValues = z.infer<typeof VehicleFormSchema>;

interface VehicleFormProps {
  vehicle: HaulierVehicle | null;
  hauliers: Haulier[];
  onSubmit: (data: Omit<HaulierVehicle, 'id'> | HaulierVehicle) => void;
  onCancel: () => void;
}

const defaultLayout: TruckLayout = {
  type: 'van',
  rows: 2,
  columns: 5,
  trolleySlots: 10,
};

const defaultValues: VehicleFormValues = {
  haulierId: '',
  name: '',
  registration: '',
  vehicleType: 'van',
  trolleyCapacity: 10,
  isActive: true,
  notes: '',
  truckLayout: defaultLayout,
};

const vehicleTypes = [
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'other', label: 'Other' },
];

export function VehicleForm({ vehicle, hauliers, onSubmit, onCancel }: VehicleFormProps) {
  const isEditing = !!vehicle;

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(VehicleFormSchema),
    defaultValues: vehicle
      ? {
          ...vehicle,
          truckLayout: vehicle.truckLayout ?? defaultLayout,
        }
      : defaultValues,
  });

  useEffect(() => {
    if (vehicle) {
      form.reset({
        ...vehicle,
        truckLayout: vehicle.truckLayout ?? defaultLayout,
      });
    } else {
      form.reset(defaultValues);
    }
  }, [vehicle, form]);

  const truckLayout = form.watch('truckLayout');
  const rows = truckLayout?.rows ?? 2;
  const columns = truckLayout?.columns ?? 5;

  // Update trolley capacity when layout changes
  useEffect(() => {
    if (truckLayout) {
      const totalSlots = truckLayout.rows * truckLayout.columns;
      form.setValue('truckLayout.trolleySlots', totalSlots);
      form.setValue('trolleyCapacity', totalSlots);
    }
  }, [rows, columns, form, truckLayout]);

  const handleSubmit = (values: VehicleFormValues) => {
    if (isEditing && vehicle) {
      onSubmit({ ...values, id: vehicle.id } as HaulierVehicle);
    } else {
      onSubmit(values as Omit<HaulierVehicle, 'id'>);
    }
  };

  // Generate truck visualization grid
  const truckGrid = useMemo(() => {
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < columns; c++) {
        row.push({ row: r, col: c });
      }
      grid.push(row);
    }
    return grid;
  }, [rows, columns]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
        <DialogDescription>
          {isEditing && vehicle
            ? `Update details for "${vehicle.name}".`
            : 'Add a new vehicle with loading configuration.'}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="haulierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Haulier</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select haulier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hauliers.map((haulier) => (
                        <SelectItem key={haulier.id} value={haulier.id!}>
                          {haulier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Van 1, Truck A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="registration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 221-D-12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle Type</FormLabel>
                  <Select value={field.value ?? 'van'} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vehicleTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Loading Layout Configuration */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Loading Layout</CardTitle>
              <CardDescription>
                Configure the truck&apos;s loading area dimensions and trolley slots.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="truckLayout.rows"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rows (front to back): {field.value}</FormLabel>
                      <FormControl>
                        <Slider
                          min={1}
                          max={6}
                          step={1}
                          value={[field.value ?? 2]}
                          onValueChange={([val]) => field.onChange(val)}
                        />
                      </FormControl>
                      <FormDescription>Number of rows from front to back</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="truckLayout.columns"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Columns (side to side): {field.value}</FormLabel>
                      <FormControl>
                        <Slider
                          min={1}
                          max={8}
                          step={1}
                          value={[field.value ?? 5]}
                          onValueChange={([val]) => field.onChange(val)}
                        />
                      </FormControl>
                      <FormDescription>Number of columns across the width</FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              {/* Visual Preview */}
              <div className="space-y-2">
                <Label>Layout Preview ({rows * columns} trolley slots)</Label>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-2 text-center">← FRONT</div>
                  <div className="flex flex-col gap-1 items-center">
                    {truckGrid.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex gap-1">
                        {row.map((cell) => (
                          <div
                            key={`${cell.row}-${cell.col}`}
                            className="w-8 h-8 border border-primary/30 bg-primary/10 rounded flex items-center justify-center text-xs text-muted-foreground"
                          >
                            {cell.row * columns + cell.col + 1}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 text-center">BACK →</div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="trolleyCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Trolley Capacity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of trolleys this vehicle can carry
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Status and Notes */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                      <Label>{field.value ? 'Active' : 'Inactive'}</Label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save changes' : 'Add vehicle'}</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
