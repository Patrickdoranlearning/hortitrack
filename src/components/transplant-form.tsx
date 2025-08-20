"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Batch, NurseryLocation, PlantSize } from '@/lib/types';
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
import { useMemo, useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { SubmitButton } from './ui/SubmitButton';
import { postJson } from "@/lib/net";

const transplantFormSchema = (maxQuantity: number) =>
  z.object({
    plantingDate: z.date({ required_error: 'Planting date is required' }),
    quantity: z.coerce
      .number()
      .min(1, 'Quantity must be at least 1.')
      .max(
        maxQuantity,
        `Quantity cannot exceed remaining stock of ${maxQuantity}.`
      ),
    status: z.enum(['Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived']),
    location: z.string().min(1, 'Location is required.').or(z.object({})), // Allow empty object temporarily for debugging
    size: z.string().min(1, 'Size is required.').or(z.object({})), // Allow empty object temporarily for debugging
    logRemainingAsLoss: z.boolean(),
    trayQuantity: z.number().optional(),
  });

export type TransplantFormData = z.infer<typeof transplantFormSchema>;

interface TransplantFormProps {
  batch: Batch | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  nurseryLocations: NurseryLocation[];
  plantSizes: PlantSize[];
}

export function TransplantForm({
  batch,
  onSubmit: onDone,
  onCancel,
  nurseryLocations,
  plantSizes,
}: TransplantFormProps) {
  const [selectedSizeInfo, setSelectedSizeInfo] = useState<PlantSize | null>(null);
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof transplantFormSchema>>({
    resolver: zodResolver(transplantFormSchema(batch?.quantity ?? 0)),
    defaultValues: batch
      ? {
          plantingDate: new Date(),
          quantity: batch.quantity,
          status: 'Potted',
          location: '',
          size: '',
          logRemainingAsLoss: false,
          trayQuantity: 1,
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
  
  const handleSizeChange = (sizeValue: string) => {
    const selectedSize = plantSizes.find(s => s.size === sizeValue);
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

  const onSubmit = async (values: TransplantFormData) => {
    // Sanity guard: prevent accidental server-action submits
    if (typeof window !== 'undefined' && (window as any).FormData && headers?.get?.("next-action")) {
        console.warn("Server Action header detected in client submit — aborting.");
        toast({ variant: "destructive", title: "Error", description: "Server Action header detected in client submit — aborting." });
        return;
    }

    if (!batch) return;

    const qty = values.quantity ?? batch.quantity;

    const payload = {
        type: "TRANSPLANT",
        sourceBatchNumber: batch.batchNumber,
        quantity: qty,
        target: {
            locationId: typeof values.location === 'string' ? values.location : null,
            size: typeof values.size === 'string' ? values.size : null,
            notes: values.logRemainingAsLoss ? "Remaining logged as loss" : null, // Assuming notes can be derived from logRemainingAsLoss
        },
    };

    console.log("[Transplant] submitting", payload);
    const res = await postJson("/api/actions", payload);
    if (!res.ok) {
      console.error("[Transplant] failed", res);
      toast({ variant: 'destructive', title: "Transplant failed", description: res.error ?? "Transplant failed" });
      return;
    }
    toast({ title: "Transplant created", description: "New batch created" });
    onDone?.();
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
          Create a new batch from existing batch #{batch?.batchNumber}.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-0"
          noValidate
        >
          <ScrollArea className="h-[70vh] p-6 pr-8 -mr-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormItem>
                  <FormLabel>New Batch Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Auto-generated" disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input value={batch.category ?? ""} disabled />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                <FormItem>
                  <FormLabel>Plant Family</FormLabel>
                  <FormControl>
                    <Input value={batch.plantFamily ?? ""} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormItem>
                  <FormLabel>Plant Variety</FormLabel>
                  <FormControl>
                    <Input value={batch.plantVariety ?? ""} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => {
                      console.log('Location field value:', field.value);
                      return (
                      <FormItem>
                        <FormLabel>New Location</FormLabel>
                        <Select
                          value={typeof field.value === 'string' ? field.value : ''}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a new location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {nurseryLocations.map((loc, i) => (
                              <SelectItem key={loc.id ?? `loc-${i}`} value={loc.name!}>
                                {loc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}}
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
                                format(field.value, 'PPP')
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
                            selected={field.value}
                            onSelect={field.onChange}
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
                          value={typeof field.value === 'string' ? field.value : ''}
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleSizeChange(value);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a new size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sortedPlantSizes.map((s, i) => (
                              <SelectItem key={s.id ?? `size-${i}`} value={s.size!}>
                                <span>{s.size} ({s.type})</span>
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
                            <Input type="number" {...field} value={field.value ?? ""} readOnly className="bg-muted" />
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
                            value={field.value ?? ""}
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
                        value={field.value ?? ''}
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
              </div>
            </ScrollArea>
          <DialogFooter className="pt-6 p-6 border-t">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={form.formState.isSubmitting}>
              Cancel
            </Button>
            <SubmitButton type="submit" pending={form.formState.isSubmitting}>
              Create Transplanted Batch
            </SubmitButton>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
