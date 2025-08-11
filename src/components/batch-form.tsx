
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
import { CalendarIcon, Plus, Trash2, PieChart, Archive, Image as ImageIcon, Upload, X } from 'lucide-react';
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
import { useState, useRef } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '@/lib/firebase';
import Image from 'next/image';
import { Progress } from './ui/progress';

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
  initialQuantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  quantity: z.coerce.number().min(0, 'Quantity must be at least 0.'),
  status: z.enum(['Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good']),
  location: z.string().min(1, 'Location is required.'),
  size: z.string().min(1, 'Size is required.'),
  supplier: z.string().min(1, 'Supplier is required.'),
  logHistory: z.array(logEntrySchema),
  growerPhotoUrl: z.string().optional(),
  salesPhotoUrl: z.string().optional(),
});

type BatchFormValues = Omit<z.infer<typeof batchSchema>, 'status'> & { status: z.infer<typeof batchSchema>['status'] | 'Archived' };

export interface BatchDistribution {
  inStock: number;
  transplanted: number;
  lost: number;
}

interface BatchFormProps {
  batch: Batch | null;
  distribution: BatchDistribution | null;
  onSubmit: (data: Omit<Batch, 'id'>) => void;
  onCancel: () => void;
  onArchive: (batchId: string) => void;
  nurseryLocations: string[];
  plantSizes: string[];
}

const storage = getStorage(app);

const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context.'));
            }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas to Blob conversion failed.'));
                }
            }, 'image/jpeg', 0.9);
        };
        img.onerror = (error) => reject(error);
    });
};

export function BatchForm({ batch, distribution, onSubmit, onCancel, onArchive, nurseryLocations, plantSizes }: BatchFormProps) {
  const [isFamilySet, setIsFamilySet] = useState(!!batch?.plantFamily);
  const [isCategorySet, setIsCategorySet] = useState(!!batch?.category);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  
  const growerPhotoInputRef = useRef<HTMLInputElement>(null);
  const salesPhotoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: batch
      ? { ...batch, supplier: batch.supplier || 'Doran Nurseries' }
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
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'growerPhotoUrl' | 'salesPhotoUrl') => {
      const file = e.target.files?.[0];
      if (!file || !batch) return;
      
      setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
      
      try {
        const resizedBlob = await resizeImage(file, 1024, 1024);
        const storageRef = ref(storage, `batch-photos/${batch.id}/${fieldName}-${Date.now()}.jpg`);
        
        // This is a simplified progress simulation. For real progress, you would use uploadBytesResumable
        setUploadProgress(prev => ({ ...prev, [fieldName]: 50 }));

        const snapshot = await uploadBytes(storageRef, resizedBlob);
        const downloadURL = await getDownloadURL(snapshot.ref);

        form.setValue(fieldName, downloadURL, { shouldValidate: true });
        setUploadProgress(prev => ({ ...prev, [fieldName]: 100 }));
      } catch (error) {
          console.error("Upload failed", error);
          setUploadProgress(prev => ({ ...prev, [fieldName]: -1 }));
      }
  };

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
        onSubmit({ ...data, initialQuantity: data.quantity } as Batch);
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

  const renderPhotoUploader = (fieldName: 'growerPhotoUrl' | 'salesPhotoUrl', label: string, ref: React.RefObject<HTMLInputElement>) => {
    const url = form.watch(fieldName);
    const progress = uploadProgress[fieldName];
    const isUploading = progress > 0 && progress < 100;
  
    return (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <div className="flex items-center gap-2">
            {url ? (
                <div className="relative w-24 h-24">
                    <Image src={url} alt={`${label} preview`} layout="fill" objectFit="cover" className="rounded-md" />
                    <Button type="button" size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6" onClick={() => form.setValue(fieldName, undefined)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                <div className="w-24 h-24 flex items-center justify-center bg-muted rounded-md">
                    <ImageIcon className="text-muted-foreground" />
                </div>
            )}
            <div className="flex-1">
                <Input type="file" accept="image/*" className="hidden" ref={ref} onChange={(e) => handleImageUpload(e, fieldName)} disabled={isUploading || !batch} />
                <Button type="button" onClick={() => ref.current?.click()} disabled={isUploading || !batch}>
                    <Upload className="mr-2" /> {url ? 'Change' : 'Upload'}
                </Button>
                {!batch && <FormDescription className="mt-2">Save batch first to enable photo uploads.</FormDescription>}
                {isUploading && <Progress value={progress} className="w-full mt-2" />}
            </div>
        </div>
      </FormItem>
    );
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4 md:flex md:flex-col">
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
                        {nurseryLocations.map(location => <SelectItem key={location} value={location}>{location}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Right Column */}
            <div className="space-y-4 md:flex md:flex-col">
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
                      <Input placeholder="Auto-populated" {...field} className={cn(isFamilySet && 'bg-green-100 dark:bg-green-900/20')} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Full Span Items */}
            <div className="md:col-span-2">
              {renderPhotoUploader('growerPhotoUrl', 'Grower Photo', growerPhotoInputRef)}
            </div>
            <div className="md:col-span-2">
              {renderPhotoUploader('salesPhotoUrl', 'Sales Photo', salesPhotoInputRef)}
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
