'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Batch, TransplantFormData } from '@/lib/types';
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
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from './ui/checkbox';

const transplantFormSchema = (maxQuantity: number) =>
  z.object({
    id: z.string(),
    batchNumber: z.string(),
    plantFamily: z.string(),
    plantVariety: z.string(),
    plantingDate: z.string().min(1, 'Planting date is required.'),
    initialQuantity: z.coerce.number(),
    quantity: z.coerce
      .number()
      .min(1, 'Quantity must be at least 1.')
      .max(
        maxQuantity,
        `Quantity cannot exceed remaining stock of ${maxQuantity}.`
      ),
    status: z.enum(['Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good']),
    location: z.string().min(1, 'Location is required.'),
    size: z.string().min(1, 'Size is required.'),
    transplantedFrom: z.string(),
    supplier: z.string().optional(),
    logHistory: z.array(
      z.object({
        date: z.string(),
        action: z.string(),
      })
    ),
    logRemainingAsLoss: z.boolean(),
  });

interface TransplantFormProps {
  batch: Batch | null;
  onSubmit: (data: TransplantFormData) => void;
  onCancel: () => void;
  nurseryLocations: string[];
  plantSizes: string[];
}

export function TransplantForm({
  batch,
  onSubmit,
  onCancel,
  nurseryLocations,
  plantSizes,
}: TransplantFormProps) {
  const form = useForm<z.infer<ReturnType<typeof transplantFormSchema>>>({
    resolver: zodResolver(transplantFormSchema(batch?.quantity ?? 0)),
    defaultValues: batch
      ? {
          id: '',
          batchNumber: '',
          plantFamily: batch.plantFamily,
          plantVariety: batch.plantVariety,
          plantingDate: new Date().toISOString(),
          initialQuantity: batch.quantity,
          quantity: batch.quantity,
          status: 'Potted',
          location: '',
          size: '',
          transplantedFrom: batch.batchNumber,
          supplier: 'Doran Nurseries',
          logHistory: [
            {
              date: new Date().toISOString().split('T')[0],
              action: `Transplanted from batch #${batch.batchNumber}`,
            },
          ],
          logRemainingAsLoss: false,
        }
      : undefined,
  });

  const handleFormSubmit = (
    data: z.infer<ReturnType<typeof transplantFormSchema>>
  ) => {
    onSubmit({ ...data, initialQuantity: data.quantity });
  };

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
            <FormField
              control={form.control}
              name="batchNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Batch Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Auto-generated" {...field} disabled />
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
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a new location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {nurseryLocations.map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
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
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
            <FormField
              control={form.control}
              name="size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Size</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a new size" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {plantSizes.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
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
                      Log remaining units as loss and archive
                    </FormLabel>
                    <FormDescription>
                      If checked, any units not transplanted will be logged as a loss, and the original batch will be archived.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

          <div className="flex justify-end gap-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Create Transplanted Batch</Button>
          </div>
        </form>
      </Form>
    </>
  );
}
