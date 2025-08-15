'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Batch, NurseryLocation, PlantSize, Supplier, Variety } from '@/lib/types';
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
import { CalendarIcon, PieChart, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DialogFooter } from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { useEffect, useMemo, useState } from 'react';
import { Combobox } from '@/components/ui/combobox';

export interface BatchDistribution {
  inStock: number;
  transplanted: number;
  lost: number;
}
interface BatchFormProps {
  batch: Batch | null;
  distribution: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  onArchive: (batchId: string) => void;
  nurseryLocations?: NurseryLocation[];
  plantSizes?: PlantSize[];
  suppliers?: Supplier[];
  varieties?: Variety[];
  onCreateNewVariety: (name: string) => void;
}

export function BatchForm({
  batch,
  distribution,
  onSubmit,
  onCancel,
  onArchive,
  nurseryLocations = [],
  plantSizes = [],
  suppliers = [],
  varieties = [],
  onCreateNewVariety,
}: BatchFormProps) {
  const [selectedSizeInfo, setSelectedSizeInfo] = useState<PlantSize | null>(null);
  const [isFamilySet, setIsFamilySet] = useState(false);
  const [isCategorySet, setIsCategorySet] = useState(false);

  const form = useForm({
    resolver: zodResolver(z.any()), // Replace with actual schema
    defaultValues: {
      plantVariety: '',
      plantFamily: '',
      category: '',
      size: '',
      quantity: '',
      trayQuantity: '',
      status: '',
      plantingDate: '',
      supplier: '',
      location: '',
      growerPhotoUrl: '',
      salesPhotoUrl: '',
    },
  });

  const customSizeSort = (a: PlantSize, b: PlantSize) => {
    if (a.type === 'Tray' && b.type !== 'Tray') return -1;
    if (a.type !== 'Tray' && b.type === 'Tray') return 1;
    if (a.type === 'Tray' && b.type === 'Tray') {
      return (b.multiple ?? 0) - (a.multiple ?? 0);
    }
    const aSize = a.size || '';
    const bSize = b.size || '';
    return aSize.localeCompare(bSize);
  };

  const sortedPlantSizes = useMemo(() => {
    return (plantSizes ?? []).slice().sort(customSizeSort);
  }, [plantSizes]);

  useEffect(() => {
    if (batch) {
      const sizeInfo = (plantSizes ?? []).find(s => s.size === batch.size);
      setSelectedSizeInfo(sizeInfo || null);
      if (sizeInfo?.multiple && sizeInfo.multiple > 1) {
        form.setValue('trayQuantity', batch.quantity / sizeInfo.multiple);
      }
    }
  }, [batch, plantSizes, form]);

  const handleFormSubmit = (data: any) => {
    const finalData = {
      ...data,
      logHistory: (data.logHistory ?? []).map((log: any) => ({
        ...log,
        id: log.id || `log_${Date.now()}_${Math.random()}`,
      })),
    };
    if (batch) {
      onSubmit({
        ...finalData,
        id: batch.id,
        batchNumber: batch.batchNumber,
        initialQuantity: batch.initialQuantity,
        createdAt: batch.createdAt,
      } as Batch);
    } else {
      onSubmit({
        ...finalData,
        initialQuantity: finalData.quantity,
      } as Omit<Batch, 'id' | 'batchNumber' | 'createdAt' | 'updatedAt'>);
    }
  };

  const handleSizeChange = (sizeId: string) => {
    const selected = (plantSizes ?? []).find(s => s.id === sizeId);
    if (!selected) return;
    form.setValue('size', selected.size, { shouldValidate: true, shouldDirty: true });
    setSelectedSizeInfo(selected);
    if (selected.multiple && selected.multiple > 1) {
      const trayQty = form.getValues('trayQuantity') || 1;
      form.setValue('quantity', trayQty * selected.multiple);
    }
  };

  const idFromName = (list: { id?: string; name: string }[], name?: string) =>
    (list ?? []).find(v => v.name === name)?.id ?? '';

  const idFromSize = (list: PlantSize[], size?: string) =>
    (list ?? []).find(v => v.size === size)?.id ?? '';

  const varietyOptions = useMemo(
    () => (varieties ?? []).map(v => ({ value: v.id!, label: v.name })),
    [varieties]
  );

  const handleVarietyChange = (varietyId: string) => {
    const v = (varieties ?? []).find(x => x.id === varietyId);
    if (!v) return;
    form.setValue('plantVariety', v.name, { shouldValidate: true, shouldDirty: true });
    form.setValue('plantFamily', v.family, { shouldValidate: true, shouldDirty: true });
    form.setValue('category', v.category, { shouldValidate: true, shouldDirty: true });
    setIsFamilySet(true);
    setIsCategorySet(true);
  };

  const handleTrayQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const trayQty = Number(e.target.value || 0);
    form.setValue('trayQuantity', trayQty, { shouldValidate: true, shouldDirty: true });
    const perTray = selectedSizeInfo?.multiple ?? 1;
    form.setValue('quantity', Math.max(0, trayQty * perTray), { shouldValidate: true, shouldDirty: true });
  };

  const showTrayFields = selectedSizeInfo?.multiple && selectedSizeInfo.multiple > 1;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          handleFormSubmit,
          (errors) => {
            console.error('Batch form invalid', errors);
            toast({
              variant: 'destructive',
              title: 'Please complete the required fields',
              description: Object.values(errors).map((e: any) => e.message).join(', '),
            });
          }
        )}
        className="space-y-0"
      >
        <ScrollArea className="h-[70vh] p-6 pr-8 -mr-6">
          {/* Variety */}
          {/* ... Replace .map() calls below with safe (arr ?? []).map() */}
          <FormField
            control={form.control}
            name="plantVariety"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Variety</FormLabel>
                <Combobox
                  options={(varieties ?? []).map((v) => ({
                    value: v.name,          // use NAME as the combobox value
                    label: v.name,
                  }))}
                  value={field.value ?? ""} // form field holds NAME
                  onChange={(selectedName) => {
                    field.onChange(selectedName); // update form field (name)
                    const v = (varieties ?? []).find(x => x.name === selectedName);
                    // keep an ID in sync if you track one elsewhere:
                    form.setValue("plantVarietyId" as any, v?.id ?? "");
                    // also update related fields if needed:
                    if (v) {
                      form.setValue("plantFamily" as any, v.family ?? "");
                      form.setValue("category" as any, v.category ?? "");
                    }
                  }}
                  onCreateOption={onCreateNewVariety}
                  placeholder="Select or create variety"
                  emptyMessage="No variety found."
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Plant Family */}
          <FormField
            control={form.control}
            name="plantFamily"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plant Family</FormLabel>
                <Input {...field} disabled={isFamilySet} placeholder="Enter plant family" />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category */}
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Input {...field} disabled={isCategorySet} placeholder="Enter category" />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Size */}
          <FormField
            control={form.control}
            name="size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Size</FormLabel>
                <Select
                  value={idFromSize(plantSizes ?? [], field.value)}
                  onValueChange={handleSizeChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a size" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(sortedPlantSizes ?? []).map((size) => (
                      <SelectItem key={size.id} value={size.id!}>
                        {size.size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tray Quantity */}
          {showTrayFields && (
            <FormField
              control={form.control}
              name="trayQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tray Quantity</FormLabel>
                  <Input
                    type="number"
                    {...field}
                    onChange={handleTrayQuantityChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {/* Quantity */}
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Quantity</FormLabel>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PROPAGATION">Propagation</SelectItem>
                    <SelectItem value="GROWING">Growing</SelectItem>
                    <SelectItem value="READY">Ready</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Planting Date */}
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
                        variant="outline"
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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

          {/* Supplier */}
          <FormField
            control={form.control}
            name="supplier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier</FormLabel>
                <Select
                  value={idFromName(suppliers ?? [], field.value)}
                  onValueChange={(id) => {
                    const s = (suppliers ?? []).find(sup => sup.id === id);
                    field.onChange(s?.name ?? "");
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(suppliers ?? []).map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id!}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Location */}
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <Select
                  value={idFromName(nurseryLocations ?? [], field.value)}
                  onValueChange={(id) => {
                    const l = (nurseryLocations ?? []).find(loc => loc.id === id);
                    field.onChange(l?.name ?? "");
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(nurseryLocations ?? []).map((loc) => (
                      <SelectItem key={loc.id} value={loc.id!}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Photos */}
          <FormField
            control={form.control}
            name="growerPhotoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grower Photo URL</FormLabel>
                <Input {...field} placeholder="https://..." />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salesPhotoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sales Photo URL</FormLabel>
                <Input {...field} placeholder="https://..." />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Distribution Bar */}
          {batch && (
            <BatchDistributionBar
              distribution={distribution}
              initialQuantity={batch.initialQuantity}
            />
          )}
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {batch && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="secondary">
                  <Archive className="mr-2 h-4 w-4" /> Archive
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive batch?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will archive the batch but keep its history. You can restore it later if needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onArchive(batch.id)}>
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button type="submit">
             Save
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
