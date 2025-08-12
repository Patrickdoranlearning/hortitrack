
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Batch, NurseryLocation, PlantSize, Supplier } from '@/lib/types';
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
import { CalendarIcon, Plus, Trash2, PieChart, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { BatchDistributionBar } from './batch-distribution-bar';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";
import { SIZE_TYPE_TO_STATUS_MAP } from '@/lib/constants';
import { VARIETIES } from '@/lib/varieties';
import { Combobox } from './ui/combobox';
import { useState, useMemo, useEffect } from 'react';

const logEntrySchema = z.object({
  id: z.string().optional(),
  date: z.any(),
  type: z.enum(['NOTE', 'LOSS', 'ADJUST', 'MOVE', 'TRANSPLANT_TO', 'TRANSPLANT_FROM', 'CREATE', 'ARCHIVE']),
  note: z.string().optional(),
});

const batchFormSchema = z.object({
  id: z.string().optional(),
  batchNumber: z.string().optional(),
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
  // Non-schema fields for form logic
  trayQuantity: z.number().optional(),
}).refine(data => {
    if (!data.id) { // Only for new batches
        return data.quantity > 0;
    }
    return true;
}, {
    message: "Quantity must be greater than 0 for a new batch.",
    path: ["quantity"],
});


type BatchFormValues = Omit<Batch, 'id' | 'batchNumber' | 'logHistory' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    batchNumber?: string;
    logHistory: { id?: string; date: any; type: any, note?: string }[];
};

export interface BatchDistribution {
  inStock: number;
  transplanted: number;
  lost: number;
}

interface BatchFormProps {
  batch: Batch | null;
  distribution: BatchDistribution | null;
  onSubmit: (data: Omit<Batch, 'id' | 'batchNumber' | 'createdAt' | 'updatedAt'> | Batch) => void;
  onCancel: () => void;
  onArchive: (batchId: string) => void;
  nurseryLocations: NurseryLocation[];
  plantSizes: PlantSize[];
  suppliers: Supplier[];
}

export function BatchForm({ batch, distribution, onSubmit, onCancel, onArchive, nurseryLocations, plantSizes, suppliers }: BatchFormProps) {
  const [isFamilySet, setIsFamilySet] = useState(!!batch?.plantFamily);
  const [isCategorySet, setIsCategorySet] = useState(!!batch?.category);
  const [selectedSizeInfo, setSelectedSizeInfo] = useState<PlantSize | null>(null);

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: batch
      ? { ...batch, initialQuantity: batch.initialQuantity || batch.quantity, supplier: batch.supplier || 'Doran Nurseries' }
      : {
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
          trayQuantity: 1,
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'logHistory',
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

    // Fallback for other types, ensure size is a string before calling localeCompare
    const aSize = a.size || '';
    const bSize = b.size || '';
    return aSize.localeCompare(bSize);
  };
  
  const sortedPlantSizes = useMemo(() => {
    return plantSizes ? [...plantSizes].sort(customSizeSort) : [];
  }, [plantSizes]);

  useEffect(() => {
    if (batch) {
        const sizeInfo = plantSizes.find(s => s.size === batch.size);
        setSelectedSizeInfo(sizeInfo || null);
        if (sizeInfo?.multiple && sizeInfo.multiple > 1) {
            form.setValue('trayQuantity', batch.quantity / sizeInfo.multiple);
        }
    }
  }, [batch, plantSizes, form]);

  const handleFormSubmit = (data: BatchFormValues) => {
    const finalData = {
        ...data,
        logHistory: data.logHistory.map(log => ({...log, id: log.id || `log_${Date.now()}_${Math.random()}`}))
    };
    if (batch) {
       onSubmit({ ...finalData, id: batch.id, batchNumber: batch.batchNumber, initialQuantity: batch.initialQuantity, createdAt: batch.createdAt } as Batch);
    } else {
        onSubmit({ ...finalData, initialQuantity: finalData.quantity } as Omit<Batch, 'id' | 'batchNumber' | 'createdAt' | 'updatedAt'>);
    }
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
  
  const handleVarietyChange = (varietyValue: string) => {
    form.setValue('plantVariety', varietyValue, { shouldValidate: true });
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

  const handleTrayQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const trayQty = parseInt(e.target.value, 10) || 0;
    form.setValue('trayQuantity', trayQty);
    if (selectedSizeInfo?.multiple && selectedSizeInfo.multiple > 1) {
      form.setValue('quantity', trayQty * selectedSizeInfo.multiple);
    }
  };

  const varietyOptions = useMemo(() => VARIETIES.map(v => ({ value: v.name, label: v.name })), []);
  const showTrayFields = selectedSizeInfo?.multiple && selectedSizeInfo.multiple > 1;
  const currentSizeId = plantSizes.find(s => s.size === form.watch('size'))?.id || '';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-headline text-2xl">{batch ? `Edit Batch #${batch.batchNumber}` : 'Create New Batch'}</DialogTitle>
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
                      allowCustomValue={true}
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
                    <Select onValueChange={handleSizeChange} value={currentSizeId}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a size" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortedPlantSizes.filter(s => s?.id && s?.size).map(size => 
                          <SelectItem key={size.id} value={size.id}>
                            <span>{size.size} ({size.type})</span>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="md:row-start-5 grid grid-cols-2 gap-4">
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
                    <FormItem className="col-span-2">
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="md:row-start-1">
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
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
                            key={`date-${field.id}`}
                            control={form.control}
                            name={`logHistory.${index}.date`}
                            render={({ field: formField }) => (
                                <FormItem className="w-1/3">
                                <FormControl>
                                    <Input type="date" {...formField} value={format(new Date(formField.value), 'yyyy-MM-dd')} onChange={(e) => formField.onChange(new Date(e.target.value).toISOString())} />
                                </FormControl>
                                </FormItem>
                            )}
                            />
                        <FormField
                            key={`note-${field.id}`}
                            control={form.control}
                            name={`logHistory.${index}.note`}
                            render={({ field: formField }) => (
                                <FormItem className="flex-1">
                                <FormControl>
                                    <Textarea placeholder="Describe the action taken..." {...formField} className="min-h-[40px]"/>
                                </FormControl>
                                </FormItem>
                            )}
                            />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ date: new Date().toISOString(), type: 'NOTE', note: '' })}>
                    <Plus className="h-4 w-4 mr-2"/>
                    Add Log Entry
                </Button>
              </div>
          </div>
          
          <DialogFooter className="flex justify-between items-center pt-4">
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
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
