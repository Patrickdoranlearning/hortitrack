
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Batch, NurseryLocation } from '@/lib/types';
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
import { CalendarIcon, Plus, Trash2, PieChart, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BatchDistributionBar } from './batch-distribution-bar';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";
import { SIZE_TO_STATUS_MAP } from '@/lib/constants';
import { VARIETIES } from '@/lib/varieties';
import { Combobox } from './ui/combobox';
import { useState } from 'react';

const logEntrySchema = z.object({
  date: z.string().min(1, "Date is required."),
  action: z.string().min(1, "Action is required."),
});

const batchSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  category: z.string().min(1, 'Category is required.'),
  plantFamily: z.string().min(1, 'Plant family is required.'),
  plantVariety: z.string().min(1, 'Plant variety is required.'),
  plantingDate: z.string().min(1, 'Planting date is required.'),
  initialQuantity: z.coerce.number(),
  quantity: z.coerce.number().min(0, 'Quantity must be at least 0.'),
  status: z.enum(['Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived']),
  location: z.string().min(1, 'Location is required.'),
  size: z.string().min(1, 'Size is required.'),
  supplier: z.string().min(1, 'Supplier is required.'),
  logHistory: z.array(logEntrySchema),
  growerPhotoUrl: z.string().optional(),
  salesPhotoUrl: z.string().optional(),
});

type BatchFormValues = z.infer<typeof batchSchema>;

export interface BatchDistribution {
  inStock: number;
  transplanted: number;
  lost: number;
}

interface BatchFormProps {
  batch: Batch | null;
  distribution: BatchDistribution | null;
  onSubmit: (data: Omit<Batch, 'id' | 'batchNumber'> | Batch) => void;
  onCancel: () => void;
  onArchive: (batchId: string) => void;
  nurseryLocations: NurseryLocation[];
  plantSizes: string[];
}

export function BatchForm({ batch, distribution, onSubmit, onCancel, onArchive, nurseryLocations, plantSizes }: BatchFormProps) {
  const [isFamilySet, setIsFamilySet] = useState(!!batch?.plantFamily);
  const [isCategorySet, setIsCategorySet] = useState(!!batch?.category);

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: batch
      ? { ...batch, initialQuantity: batch.initialQuantity || batch.quantity, supplier: batch.supplier || 'Doran Nurseries' }
      : {
          id: Date.now().toString(),
          batchNumber: '',
          category: '',
          plantFamily: '',
          plantVariety: '',
          plantingDate: new Date().toISOString(),
          initialQuantity: 1,
          quantity: 1,
          status: 'Propagation',
          location: '',
          size: '',
          supplier: 'Doran Nurseries',
          logHistory: [],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'logHistory',
  });

  const handleFormSubmit = (data: BatchFormValues) => {
    if (batch) {
      const batchNumberPrefix = {
        'Propagation': '1',
        'Plugs/Liners': '2',
        'Potted': '3',
        'Ready for Sale': '4',
        'Looking Good': '6',
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

       onSubmit({ ...data, batchNumber: finalBatchNumber, initialQuantity: batch.initialQuantity } as Batch);
    } else {
        onSubmit({ ...data, initialQuantity: data.quantity } as Omit<Batch, 'id' | 'batchNumber'>);
    }
  };

  const handleSizeChange = (size: string) => {
    form.setValue('size', size);
    const newStatus = SIZE_TO_STATUS_MAP[size];
    if (newStatus) {
      form.setValue('status', newStatus);
    }
  };
  
  const handleVarietyChange = (varietyValue: string) => {
    form.setValue('plantVariety', varietyValue);
    const selectedVariety = VARIETIES.find(v => v.name.toLowerCase() === varietyValue.toLowerCase());
    if (selectedVariety) {
      form.setValue('plantFamily', selectedVariety.family, { shouldValidate: true });
      form.setValue('category', selectedVariety.category, { shouldValidate: true });
      setIsFamilySet(true);
      setIsCategorySet(true);
    } else {
      setIsFamilySet(false);
      setIsCategorySet(false);
    }
  };

  const varietyOptions = VARIETIES.map(v => ({ value: v.name, label: v.name }));

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
          <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-5 gap-x-8 gap-y-4">
            
            <div className="md:row-start-1">
              <FormField
                control={form.control}
                name="plantVariety"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Plant Variety</FormLabel>
                    <Combobox
                      options={varietyOptions}
                      value={field.value}
                      onChange={handleVarietyChange}
                      placeholder="Select variety..."
                      emptyMessage="No matching variety found."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="md:row-start-2">
               <FormField
                control={form.control}
                name="plantFamily"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plant Family</FormLabel>
                    <FormControl>
                      <Input placeholder="Auto-populated" {...field} className={cn(isFamilySet && 'bg-green-100 dark:bg-green-900/20')} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="md:row-start-3">
               <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="Auto-populated" {...field} className={cn(isCategorySet && 'bg-green-100 dark:bg-green-900/20')} disabled/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="md:row-start-4">
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size</FormLabel>
                    <Select onValueChange={handleSizeChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a size" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {plantSizes.map(size => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="md:row-start-5">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="md:row-start-1">
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
            </div>

            <div className="md:row-start-2">
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
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(new Date(field.value), 'PPP') : <span>Pick a date</span>}
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
            </div>
            
            <div className="md:row-start-3">
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Doran Nurseries" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="md:row-start-4">
               <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {nurseryLocations.map(location => <SelectItem key={location.id} value={location.name}>{location.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="md:row-start-5">
               <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={field.value === 'Archived'}>
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
                        <SelectItem value="Looking Good">Looking Good</SelectItem>
                         {field.value === 'Archived' && (
                          <SelectItem value="Archived" disabled>Archived</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
            
          <div className="md:col-span-2">
            {distribution && batch && (batch.initialQuantity > 0) && (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
                    <h3 className="flex items-center font-semibold mb-2"><PieChart className="mr-2 h-4 w-4"/>Batch Distribution</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        A breakdown of where the initial {batch.initialQuantity} units have gone.
                    </p>
                    <BatchDistributionBar distribution={distribution} initialQuantity={batch.initialQuantity} />
                </div>
            )}
          </div>

          <div className="md:col-span-2">
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
                                    <Input type="date" {...field} value={format(new Date(field.value), 'yyyy-MM-dd')} onChange={(e) => field.onChange(new Date(e.target.value).toISOString())} />
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
                <Button type="button" variant="outline" size="sm" onClick={() => append({ date: new Date().toISOString(), action: '' })}>
                    <Plus className="h-4 w-4 mr-2"/>
                    Add Log Entry
                </Button>
              </div>
          </div>
          
          <div className="flex justify-between items-center pt-4">
            <div>
              {batch && batch.status !== 'Archived' && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive">
                            <Archive className="mr-2 h-4 w-4" />
                            Archive Batch
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will archive the batch, setting its quantity to 0. The remaining {batch.quantity} units will be logged as a loss. This action cannot be undone.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onArchive(batch.id)}>
                            Yes, archive it
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="flex gap-4">
                <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
                </Button>
                <Button type="submit">{batch ? 'Save Changes' : 'Create Batch'}</Button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}
