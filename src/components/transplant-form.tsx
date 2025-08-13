
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Batch, TransplantFormData, NurseryLocation, PlantSize } from '@/lib/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from './ui/checkbox';
import { SIZE_TYPE_TO_STATUS_MAP } from '@/lib/constants';
import { useMemo, useState, useEffect } from 'react';

const transplantFormSchema = (maxQuantity: number) =>
  z.object({
    category: z.string(),
    plantFamily: z.string(),
    plantVariety: z.string(),
    plantingDate: z.string().min(1, 'Planting date is required.'),
    quantity: z.coerce
      .number()
      .min(1, 'Quantity must be at least 1.')
      .max(
        maxQuantity,
        `Quantity cannot exceed remaining stock of ${maxQuantity}.`
      ),
    status: z.enum(['Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived']),
    location: z.string().min(1, 'Location is required.'),
    size: z.string().min(1, 'Size is required.'),
    transplantedFrom: z.string().optional(),
    supplier: z.string().optional(),
    logRemainingAsLoss: z.boolean(),
    growerPhotoUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
    salesPhotoUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
    trayQuantity: z.number().optional(),
  });

interface TransplantFormProps {
  batch: Batch | null;
  onSubmit: (data: TransplantFormData) => void;
  onCancel: () => void;
  nurseryLocations: NurseryLocation[];
  plantSizes: PlantSize[];
}

const idFromName = (list: {id?: string; name?: string}[], name?: string) =>
  list.find(x => x.name === name)?.id ?? '';

const idFromSize = (list: {id?: string; size?: string}[], size?: string) =>
  list.find(x => x.size === size)?.id ?? '';

export function TransplantForm({
  batch,
  onSubmit,
  onCancel,
  nurseryLocations,
  plantSizes,
}: TransplantFormProps) {
  const [selectedSizeInfo, setSelectedSizeInfo] = useState<PlantSize | null>(null);
  
  const form = useForm<z.infer<ReturnType<typeof transplantFormSchema>>>({
    resolver: zodResolver(transplantFormSchema(batch?.quantity ?? 0)),
    defaultValues: batch
      ? {
          category: batch.category,
          plantFamily: batch.plantFamily,
          plantVariety: batch.plantVariety,
          plantingDate: new Date().toISOString(),
          quantity: batch.quantity,
          status: 'Potted',
          location: '',
          size: '',
          transplantedFrom: batch.batchNumber,
          supplier: 'Doran Nurseries',
          logRemainingAsLoss: false,
          trayQuantity: 1,
          growerPhotoUrl: '',
          salesPhotoUrl: '',
        }
      : undefined,
  });
  
  const customSizeSort = (a: PlantSize, b: PlantSize) => {
    const typeOrder: Record<string, number> = { 'Pot': 1, 'Tray': 2, 'Bareroot': 3 };

    const typeA = typeOrder[a.type] || 99;
    const typeB = typeOrder[b.type] || 99;

    if (typeA !== typeB) {
      return typeA - typeB;
    }

    const sizeA = parseFloat(a.size);
    const sizeB = parseFloat(b.size);

    if (a.type === 'Pot') {
      return sizeA - sizeB;
    }

    if (a.type === 'Tray') {
      return sizeB - sizeA;
    }

    const aSize = a.size || '';
    const bSize = b.size || '';
    return aSize.localeCompare(bSize);
  };

  const sortedPlantSizes = useMemo(() => {
    return plantSizes ? [...plantSizes].sort(customSizeSort) : [];
  }, [plantSizes]);

  const handleFormSubmit = (
    data: z.infer<ReturnType<typeof transplantFormSchema>>
  ) => {
    onSubmit({ ...data, initialQuantity: data.quantity });
  };
  
  const handleSizeChange = (sizeId: string) => {
    const selectedSize = plantSizes.find(s => s.id === sizeId);
    if (selectedSize) {
      form.setValue('size', selectedSize.size);
      setSelectedSizeInfo(selectedSize);
      const newStatus = SIZE_TYPE_TO_STATUS_MAP[selectedSize.type];
      if (newStatus) {
        form.setValue('status', newStatus);
      }
      if (selectedSize.multiple && selectedSize.multiple > 1) {
        const trayQty = form.getValues('trayQuantity') || 1;
        form.setValue('quantity', trayQty * selectedSize.multiple);
      }
    }
  };

  const handleTrayQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const trayQty = parseInt(e.target.value, 10) || 0;
    form.setValue('trayQuantity', trayQty);
    if (selectedSizeInfo?.multiple && selectedSizeInfo.multiple > 1) {
      const newQuantity = trayQty * selectedSizeInfo.multiple;
      form.setValue('quantity', newQuantity);
      if (batch && newQuantity > batch.quantity) {
        form.setError('quantity', { type: 'manual', message: `Quantity cannot exceed remaining stock of ${batch.quantity}.`});
      } else {
        form.clearErrors('quantity');
      }
    }
  };

  const showTrayFields = selectedSizeInfo?.multiple && selectedSizeInfo.multiple > 1;

  if (!batch) {
    return null;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-headline text-2xl">
          Transplant Batch
        </DialogTitle>
        <DialogDescription>
          Create a new batch from an existing one. Original batch is #
          {batch?.batchNumber}.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormItem>
              <FormLabel>New Batch Number</FormLabel>
              <FormControl>
                <Input placeholder="Auto-generated" disabled />
              </FormControl>
              <FormMessage />
            </FormItem>
            <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <FormField
              control={form.control}
              name="plantFamily"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plant Family</FormLabel>
                  <FormControl>
                    <Input {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plantVariety"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plant Variety</FormLabel>
                  <FormControl>
                    <Input {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Location</FormLabel>
                  <Select
                    onValueChange={(id) => {
                      const selected = nurseryLocations.find(l => l.id === id);
                      field.onChange(selected?.name ?? '');
                    }}
                    defaultValue={idFromName(nurseryLocations, field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a new location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {nurseryLocations.map((location, i) => (
                        <SelectItem key={location.id ?? `${location.name}-${i}`} value={location.id!}>
                          {location.name}
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
              name="plantingDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Transplant Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          field.value ? new Date(field.value) : undefined
                        }
                        onSelect={(date) =>
                          field.onChange(date?.toISOString())
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Size</FormLabel>
                  <Select
                    onValueChange={handleSizeChange}
                    defaultValue={idFromSize(sortedPlantSizes, field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a new size" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sortedPlantSizes.filter(s => s?.id && s?.size).map((size, i) => (
                        <SelectItem key={size.id ?? `${size.size}-${i}`} value={size.id!}>
                          <span>{size.size} ({size.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showTrayFields ? (
              <>
                 <FormField
                  control={form.control}
                  name="trayQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. of Trays</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={handleTrayQuantityChange} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Plants</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} readOnly className="bg-muted" />
                      </FormControl>
                       <FormDescription>
                        Max available: {batch?.quantity}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to Transplant</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Max available: {batch?.quantity}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Propagation">Propagation</SelectItem>
                      <SelectItem value="Plugs/Liners">Plugs/Liners</SelectItem>
                      <SelectItem value="Potted">Potted</SelectItem>
                      <SelectItem value="Ready for Sale">
                        Ready for Sale
                      </SelectItem>
                      <SelectItem value="Looking Good">Looking Good</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
              control={form.control}
              name="logRemainingAsLoss"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Log remaining units as loss and archive original batch
                    </FormLabel>
                    <FormDescription>
                      If checked, any units not transplanted will be logged as a loss, and the original batch #{batch.batchNumber} will be archived.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Create Transplanted Batch</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
