'use client';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { VarietyCombobox, type VarietyOption } from '@/components/ui/variety-combobox';
import { format } from 'date-fns';
import type {
  Batch, BatchStatus, NurseryLocation, PlantSize, Supplier, Variety,
} from '@/lib/types';

const BatchFormSchema = z.object({
  plantVariety: z.string().min(1, 'Variety is required'),
  plantFamily: z.string().min(1, 'Family is required'),
  category: z.string().min(1, 'Category is required'),
  size: z.string().min(1, 'Size is required'),
  trayQuantity: z.coerce.number().int().nonnegative().optional().nullable(),
  quantity: z.coerce.number().int().nonnegative('Quantity must be ≥ 0'),
  status: z.enum([
    'Propagation',
    'Plugs/Liners',
    'Potted',
    'Ready for Sale',
    'Looking Good',
    'Archived',
  ] as const),
  plantingDate: z.date({ required_error: 'Planting date is required' }),
  supplier: z.string().optional().nullable(),
  location: z.string().min(1, 'Location is required'),
});

type BatchFormValues = z.infer<typeof BatchFormSchema>;

type Props = {
  batch: Batch | null; // null = create
  onSubmitSuccess?: (res: { id: string; batchNumber?: string }) => void;
  onCreated?: (res: { id: string; batchNumber: string }) => void;
  onCancel: () => void;
  onArchive?: (batchId: string) => void;
  nurseryLocations: NurseryLocation[];
  plantSizes: PlantSize[];
  suppliers?: Supplier[];
  varieties: Variety[];
  onCreateNewVariety: (name: string) => void;
};

function parseToDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate(); // Firestore Timestamp
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function BatchForm({
  batch = null,
  onSubmitSuccess,
  onCreated,
  onCancel,
  onArchive,
  varieties = [],
  nurseryLocations = [],
  plantSizes = [],
  suppliers = [],
  onCreateNewVariety,
}: Props) {
  const [selectedSizeInfo, setSelectedSizeInfo] = useState<PlantSize | null>(null);
  const isEdit = !!batch?.id;

  const onSuccess = React.useMemo(() => {
    if (onSubmitSuccess) return onSubmitSuccess;
    if (onCreated) {
      return (res: { id: string; batchNumber?: string }) => {
        if (res.batchNumber) {
          onCreated({ id: res.id, batchNumber: res.batchNumber });
        }
      };
    }
    return () => {};
  }, [onSubmitSuccess, onCreated]);

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(BatchFormSchema),
    mode: 'onChange',
    defaultValues: {
      plantVariety: batch?.plantVariety ?? '',
      plantFamily: batch?.plantFamily ?? '',
      category: batch?.category ?? '',
      size: batch?.size ?? '',
      trayQuantity: null,
      quantity: batch?.quantity ?? 0,
      status: (batch?.status as BatchStatus) ?? 'Potted',
      plantingDate: parseToDate(batch?.plantingDate),
      supplier: batch?.supplier ?? '',
      location: batch?.location ?? '',
      growerPhotoUrl: '',
      salesPhotoUrl: '',
    },
  });

  useEffect(() => {
    const info = (plantSizes ?? []).find((s) => s.size === form.getValues('size')) || null;
    setSelectedSizeInfo(info);
    if (info?.multiple && info.multiple > 1 && batch?.quantity) {
      form.setValue('trayQuantity', Math.round(batch.quantity / info.multiple));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, plantSizes]);

  const sizeMultiple = selectedSizeInfo?.multiple && selectedSizeInfo.multiple > 1
    ? selectedSizeInfo.multiple
    : 1;
  const isTrayMode = sizeMultiple > 1;

  const varietyOptions: VarietyOption[] = useMemo(
    () =>
      (varieties ?? []).map((v) => ({
        id: v.id!,
        name: v.name,
        family: v.family,
        category: v.category,
      })),
    [varieties]
  );

  const onSubmit = async (values: BatchFormValues) => {
    const payload = {
      category: values.category,
      plantFamily: values.plantFamily,
      plantVariety: values.plantVariety,
      plantingDate: values.plantingDate.toISOString(),
      initialQuantity: isEdit ? (batch?.initialQuantity ?? values.quantity) : values.quantity,
      quantity: values.quantity,
      status: values.status,
      location: values.location,
      size: values.size,
      supplier: values.supplier ? values.supplier : undefined,
    };

    if (isEdit && batch?.id) {
      const res = await fetch(`/api/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to update batch');
      }
      onSuccess({ id: batch.id });
      return;
    }

    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to create batch');
    }
    const result = (await res.json()) as { id: string; batchNumber: string };
    onSuccess(result);

    form.reset({
      plantVariety: '',
      plantFamily: '',
      category: '',
      size: '',
      trayQuantity: null,
      quantity: 0,
      status: 'Potted',
      plantingDate: new Date(),
      supplier: '',
      location: '',
    });
  };

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (vals) => {
          try {
            // compute total when in tray mode before submit
            if (isTrayMode) {
              const trays = Number(form.getValues('trayQuantity') ?? 0);
              form.setValue('quantity', trays * sizeMultiple, { shouldValidate: true });
            }
            await onSubmit(vals);
          } catch (e: any) {
            console.error(e);
            alert(e.message || 'Save failed');
          }
        })}
        noValidate
      >
        {/* Header: batch number info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              {isEdit ? `Batch #${batch?.batchNumber ?? batch?.id}` : 'Batch Number'}
            </div>
            <div className="font-semibold">
              {isEdit ? 'Read-only' : 'Auto-generated on save'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hidden fields to carry family & category */}
          <input type="hidden" {...form.register('plantFamily')} />
          <input type="hidden" {...form.register('category')} />

          {/* Variety */}
          <FormField
            control={form.control}
            name="plantVariety"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Variety</FormLabel>
                <VarietyCombobox
                  value={field.value || ''}
                  disabled={form.formState.isSubmitting}
                  varieties={varietyOptions}
                  onSelect={(v) => {
                    field.onChange(v.name);
                    if (v.family) {
                      form.setValue('plantFamily', v.family, { shouldValidate: true, shouldDirty: true });
                    }
                    if (v.category) {
                      form.setValue('category', v.category, { shouldValidate: true, shouldDirty: true });
                    }
                  }}
                  onCreate={(name) => onCreateNewVariety(name)}
                  placeholder="Search or create variety…"
                  emptyMessage="No matches."
                />
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-muted px-2 py-1">
                    Family: {form.watch('plantFamily') || '—'}
                  </span>
                  <span className="rounded bg-muted px-2 py-1">
                    Category: {form.watch('category') || '—'}
                  </span>
                </div>
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
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  disabled={form.formState.isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {(nurseryLocations ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.name}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  value={field.value || ''}
                  onValueChange={(val) => {
                    field.onChange(val);
                    const info = (plantSizes ?? []).find((s) => s.size === val) || null;
                    setSelectedSizeInfo(info);
                    const trays = Number(form.getValues('trayQuantity') ?? 0);
                    const perTray = info?.multiple && info.multiple > 1 ? info.multiple : 1;
                    if (perTray > 1 && trays > 0) {
                      form.setValue('quantity', trays * perTray, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }
                  }}
                  disabled={form.formState.isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a size" />
                  </SelectTrigger>
                  <SelectContent>
                    {(plantSizes ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.size}>
                        {s.size}
                        {s.type ? ` • ${s.type}` : ''}
                        {s.multiple && s.multiple > 1 ? ` (x${s.multiple}/tray)` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tray Quantity (only if multiple > 1) */}
          {isTrayMode && (
            <FormField
              control={form.control}
              name="trayQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tray Quantity</FormLabel>
                  <Input
                    type="number"
                    value={field.value ?? ''} // never null warning
                    onChange={(e) => {
                      const trays = Number(e.target.value || 0);
                      field.onChange(trays);
                      form.setValue('quantity', trays * sizeMultiple, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    disabled={form.formState.isSubmitting}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {`${field.value ?? 0} trays × ${sizeMultiple} per tray = ${form.watch('quantity')}`}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Total Quantity (always shown) */}
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Quantity</FormLabel>
                <Input
                  type="number"
                  value={Number(field.value ?? 0)}
                  onChange={(e) => field.onChange(Number(e.target.value || 0))}
                  disabled={form.formState.isSubmitting || isTrayMode}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {isTrayMode
                    ? 'Computed from trays × per-tray multiple'
                    : 'Multiple = 1 (pots); you can type total directly'}
                </div>
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
                  disabled={form.formState.isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Propagation">Propagation</SelectItem>
                    <SelectItem value="Plugs/Liners">Plugs/Liners</SelectItem>
                    <SelectItem value="Potted">Potted</SelectItem>
                    <SelectItem value="Ready for Sale">Ready for Sale</SelectItem>
                    <SelectItem value="Looking Good">Looking Good</SelectItem>
                    <SelectItem value="Archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Planting date */}
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
                        type="button"
                        variant="outline"
                        className="justify-between"
                        disabled={form.formState.isSubmitting}
                      >
                        {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                        <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(d) => d && field.onChange(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Supplier (optional) */}
          <FormField
            control={form.control}
            name="supplier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier</FormLabel>
                <Select
                  value={field.value || ''}
                  onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                  disabled={form.formState.isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(suppliers ?? [])
                      .filter((s) => s?.name?.trim()) // avoid accidental empty values
                      .map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>

          {isEdit && onArchive && batch?.id && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onArchive(batch.id!)}
              disabled={form.formState.isSubmitting}
            >
              Archive
            </Button>
          )}

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            aria-disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Batch'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}