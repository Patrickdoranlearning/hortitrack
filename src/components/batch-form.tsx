'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Batch } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const logEntrySchema = z.object({
  date: z.string().min(1, "Date is required."),
  action: z.string().min(1, "Action is required."),
});

const batchSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  plantFamily: z.string().min(1, 'Plant family is required.'),
  plantVariety: z.string().min(1, 'Plant variety is required.'),
  plantingDate: z.string().min(1, 'Planting date is required.'),
  initialQuantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  quantity: z.coerce.number().min(0, 'Quantity must be at least 0.'),
  status: z.enum(['Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Archived']),
  location: z.string().min(1, 'Location is required.'),
  size: z.string().min(1, 'Size is required.'),
  logHistory: z.array(logEntrySchema),
});

type BatchFormValues = z.infer<typeof batchSchema>;

interface BatchFormProps {
  batch: Batch | null;
  onSubmit: (data: Omit<Batch, 'id'>) => void;
  onCancel: () => void;
  nurseryLocations: string[];
  plantSizes: string[];
}

export function BatchForm({ batch, onSubmit, onCancel, nurseryLocations, plantSizes }: BatchFormProps) {
  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: batch
      ? { ...batch, plantingDate: batch.plantingDate }
      : {
          id: Date.now().toString(),
          batchNumber: '',
          plantFamily: '',
          plantVariety: '',
          plantingDate: new Date().toISOString(),
          initialQuantity: 1,
          quantity: 1,
          status: 'Propagation',
          location: '',
          size: '',
          logHistory: [],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'logHistory',
  });

  const handleFormSubmit = (data: BatchFormValues) => {
    const finalStatus = data.quantity === 0 ? 'Archived' : data.status;

    if (batch) {
      const batchNumberPrefix = {
        'Propagation': '1',
        'Plugs/Liners': '2',
        'Potted': '3',
        'Ready for Sale': '4',
        'Archived': '5'
      };
      // For existing batches, we might need to update the prefix if the status changes
      const currentPrefix = batch.batchNumber.split('-')[0];
      const newPrefix = batchNumberPrefix[data.status];
      let finalBatchNumber = batch.batchNumber;
      if (currentPrefix !== newPrefix) {
        const numberPart = batch.batchNumber.split('-')[1] || '0';
        finalBatchNumber = `${newPrefix}-${numberPart}`;
      }

       onSubmit({ ...data, batchNumber: finalBatchNumber, status: finalStatus, initialQuantity: batch.initialQuantity });
    } else {
        onSubmit({ ...data, status: finalStatus, initialQuantity: data.quantity });
    }
  };
  
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-headline text-2xl">{batch ? 'Edit Batch' : 'Create New Batch'}</DialogTitle>
        <DialogDescription>
          {batch ? 'Update the details for this nursery stock batch.' : 'Enter the details for the new nursery stock batch.'}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="batchNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch Number</FormLabel>
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
                    <Input placeholder="e.g., Lavender" {...field} />
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
                    <Input placeholder="e.g., Hidcote" {...field} />
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
                  <FormLabel>Location</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a location" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {nurseryLocations.map(location => (
                                <SelectItem key={location} value={location}>{location}</SelectItem>
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
                  <FormLabel>Planting Date</FormLabel>
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
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => field.onChange(date?.toISOString())}
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
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Propagation">Propagation</SelectItem>
                      <SelectItem value="Plugs/Liners">Plugs/Liners</SelectItem>
                      <SelectItem value="Potted">Potted</SelectItem>
                      <SelectItem value="Ready for Sale">Ready for Sale</SelectItem>
                      <SelectItem value="Archived" disabled>Archived</SelectItem>
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
                  <FormLabel>Size</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a size" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {plantSizes.map(size => (
                                <SelectItem key={size} value={size}>{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div>
             <FormLabel>Log History</FormLabel>
             <div className="space-y-2 pt-2">
                {fields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-2">
                         <FormField
                            control={form.control}
                            name={`logHistory.${index}.date`}
                            render={({ field }) => (
                                <FormItem className="w-1/3">
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                </FormItem>
                            )}
                            />
                        <FormField
                            control={form.control}
                            name={`logHistory.${index}.action`}
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                <FormControl>
                                    <Textarea placeholder="Describe the action taken..." {...field} className="min-h-[40px]"/>
                                </FormControl>
                                </FormItem>
                            )}
                            />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ date: new Date().toISOString().split('T')[0], action: '' })}>
                    <Plus className="h-4 w-4 mr-2"/>
                    Add Log Entry
                </Button>
             </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">{batch ? 'Save Changes' : 'Create Batch'}</Button>
          </div>
        </form>
      </Form>
    </>
  );
}
