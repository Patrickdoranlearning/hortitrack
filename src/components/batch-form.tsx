
'use client';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import type {
  Batch, PlantSize as PlantSizeType,
} from '@/lib/types';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { cn } from '@/lib/utils';
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { useAttributeOptions } from "@/hooks/useAttributeOptions";
import { useCompanyName } from "@/lib/org/context";

const PassportFields = {
  passportType: z.enum(["received", "issued"]).optional(),
  passportBotanical: z.string().optional(),
  passportOperator: z.string().optional(),
  passportTraceCode: z.string().optional(),
  passportOrigin: z.string().optional(),
  passportPZ: z.any().optional(),
};

const BatchFormSchema = z.object({
  sourceType: z.enum(["Propagation", "Purchase"]).default("Propagation"),
  plantVariety: z.string().min(1, 'Variety is required'),
  plantFamily: z.string().min(1, 'Family is required'),
  category: z.string().min(1, 'Category is required'),
  size: z.string().min(1, 'Size is required'),
  trayQuantity: z.coerce.number().int().nonnegative().optional().nullable(),
  quantity: z.coerce.number().int().nonnegative('Quantity must be ≥ 0'),
  status: z.string().min(1, 'Status is required'),
  plantingDate: z.date({ required_error: 'Planting date is required' }),
  supplier: z.string().optional().nullable(),
  location: z.string().min(1, 'Location is required'),
  growerPhotoUrl: z.string().optional(),
  salesPhotoUrl: z.string().optional(),
  ...PassportFields,
}).superRefine((data, ctx) => {
  if (data.sourceType === "Purchase") {
    if (!data.passportBotanical) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Botanical Name is required for purchases.", path: ["passportBotanical"] });
    }
    if (!data.passportOperator) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Operator is required for purchases.", path: ["passportOperator"] });
    }
    if (!data.passportTraceCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Traceability Code is required for purchases.", path: ["passportTraceCode"] });
    }
    if (!data.passportOrigin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Country of Origin is required for purchases.", path: ["passportOrigin"] });
    }
  }
});

type BatchFormValues = z.infer<typeof BatchFormSchema>;

type Props = {
  batch: Batch | null; // null = create
  onSubmitSuccess?: (res: { id: string; batchNumber?: string }) => void;
  onCreated?: (res: { id: string; batchNumber: string }) => void;
  onCancel: () => void;
  onArchive?: (batchId: string) => void;
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
  onCreateNewVariety,
}: Props) {
  const [selectedSizeInfo, setSelectedSizeInfo] = useState<PlantSizeType | null>(null);
  const isEdit = !!batch?.id;

  const { data, loading, reload } = React.useContext(ReferenceDataContext);
  const { options: statusOptions, loading: statusLoading } = useAttributeOptions("production_status");
  const companyName = useCompanyName();
  
  // Auto-refresh reference data when user returns from creating a new entity in another tab
  useRefreshOnFocus(reload);

  // Find the internal/own nursery supplier by matching the organization name
  const internalSupplier = useMemo(() => (data?.suppliers ?? []).find(s => s.name === companyName), [data?.suppliers, companyName]);

  const onSuccess = React.useMemo(() => {
    if (onSubmitSuccess) return onSubmitSuccess;
    if (onCreated) {
      return (res: { id: string; batchNumber?: string }) => {
        if (res.batchNumber) {
          onCreated({ id: res.id, batchNumber: res.batchNumber });
        }
      };
    }
    return () => { };
  }, [onSubmitSuccess, onCreated]);

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(BatchFormSchema),
    mode: 'onChange',
    defaultValues: {
      sourceType: batch?.sourceType ?? "Propagation",
      plantVariety: batch?.plantVariety ?? '',
      plantFamily: batch?.plantFamily ?? '',
      category: batch?.category ?? '',
      size: batch?.size ?? '',
      trayQuantity: null,
      quantity: batch?.quantity ?? 0,
      status: batch?.status ?? '',
      plantingDate: parseToDate(batch?.plantingDate),
      supplier: batch?.supplier ?? (internalSupplier?.name || ''),
      location: batch?.location ?? '',
      growerPhotoUrl: batch?.growerPhotoUrl ?? '',
      salesPhotoUrl: batch?.salesPhotoUrl ?? '',
      // Passport fields
      passportBotanical: batch?.passportBotanical ?? '',
      passportOperator: batch?.passportOperator ?? '',
      passportTraceCode: batch?.passportTraceCode ?? '',
      passportOrigin: batch?.passportOrigin ?? '',
    },
  });

  const sourceType = form.watch("sourceType");

  useEffect(() => {
    if (!statusOptions.length) return;
    const current = form.getValues("status");
    if (current) return;
    if (batch?.status) {
      form.setValue("status", batch.status, { shouldValidate: true });
    } else {
      form.setValue("status", statusOptions[0].systemCode, { shouldValidate: true });
    }
  }, [statusOptions, batch?.status, form]);

  useEffect(() => {
    if (sourceType === "Propagation") {
      form.setValue('supplier', internalSupplier?.name || '');
    } else {
      if (form.getValues('supplier') === internalSupplier?.name) {
        form.setValue('supplier', '');
      }
    }
  }, [sourceType, internalSupplier, form]);

  const sizeMultiple = selectedSizeInfo?.multiple && selectedSizeInfo.multiple > 1
    ? selectedSizeInfo.multiple
    : 1;
  const isTrayMode = sizeMultiple > 1;

  const onSubmit = async (values: BatchFormValues) => {
    if (!values.size || values.size.trim().length === 0) {
      form.setError("size", { type: "manual", message: "Size is required" });
      return;
    }

    if (isEdit) {
      const currentInitial = batch?.initialQuantity ?? values.quantity;
      if (values.quantity > currentInitial) {
        form.setError("quantity", { type: "manual", message: "Quantity cannot exceed initial quantity" });
        return;
      }
    }

    const payload: Partial<Batch> = {
      ...values,
      initialQuantity: isEdit ? (batch?.initialQuantity ?? values.quantity) : values.quantity,
      plantingDate: values.plantingDate.toISOString(),
    };

    if (values.sourceType === "Purchase") {
      payload.passportType = "received";
    }

    const api = isEdit ? `/api/batches/${batch!.id}` : '/api/batches';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(api, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to save batch');
    }
    const result = await res.json();
    onSuccess(result);

    form.reset({
      sourceType: "Propagation",
      plantVariety: '',
      plantFamily: '',
      category: '',
      size: '',
      trayQuantity: null,
      quantity: 0,
      status: statusOptions[0]?.systemCode ?? '',
      plantingDate: new Date(),
      supplier: '',
      location: '',
      growerPhotoUrl: '',
      salesPhotoUrl: '',
    });
  };

  if (loading || statusLoading) {
    return <p className="text-sm text-muted-foreground">Loading options…</p>;
  }

  const varieties = data?.varieties ?? [];
  const sizes = data?.sizes ?? [];
  const locations = (data?.locations ?? []).filter((l: any) => !l.is_virtual);
  const suppliers = data?.suppliers ?? [];

  const varietyOptions = varieties.map(v => ({ value: v.name, label: v.name }));

  const sortedSizes = [...sizes].sort((a, b) => {
    const order = (t: string) => (t === "pot" ? 0 : t.toLowerCase().includes("plug") ? 1 : 2);
    return order(a.containerType) - order(b.containerType) || a.name.localeCompare(b.name);
  });
  const sizeOptions = sortedSizes.map(s => ({ value: s.name, label: s.name }));

  const locationOptions = locations.map(l => ({ value: l.name, label: `${l.nursery_site} · ${l.name}` }));
  const supplierOptions = suppliers.map(s => ({ value: s.name, label: s.name }));


  return (
    <Form {...form}>
      <form
        id="batch-form"
        className="space-y-6 min-w-0"
        onSubmit={form.handleSubmit(async (vals) => {
          try {
            if (isTrayMode) {
              const trays = Number(form.getValues('trayQuantity') ?? 0);
              form.setValue('quantity', trays * sizeMultiple, { shouldValidate: true });
            }
            const selectedVariety = varieties.find(v => v.name === vals.plantVariety);
            if (selectedVariety) {
              vals.plantFamily = selectedVariety.family ?? '';
              vals.category = selectedVariety.category ?? '';
            }

            await onSubmit(vals);
          } catch (e: any) {
            console.error(e);
            form.setError("root.serverError", { type: "manual", message: e.message || "Save failed" });
          }
        })}
        noValidate
      >
        <FormField
          control={form.control}
          name="sourceType"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Source Type</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={(value) => field.onChange(value as "Propagation" | "Purchase")}
                  defaultValue={field.value}
                  className="flex space-x-4"
                >
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="Propagation" />
                    </FormControl>
                    <FormLabel className="font-normal">Propagation</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="Purchase" />
                    </FormControl>
                    <FormLabel className="font-normal">Purchase</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormDescription>
                Select if this batch was propagated in-house or purchased from a supplier.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 *:min-w-0">
          <input type="hidden" {...form.register('plantFamily')} />
          <input type="hidden" {...form.register('category')} />

          <FormField
            control={form.control}
            name="plantVariety"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Variety</FormLabel>
                <SearchableSelect
                  options={[
                    ...varietyOptions,
                    ...(field.value && !varietyOptions.some(o => o.value === field.value)
                      ? [{ value: field.value, label: `${field.value} (retired)` }]
                      : []),
                  ]}
                  value={field.value}
                  onValueChange={field.onChange}
                  createHref="/varieties"
                  placeholder="Select a variety"
                  createLabel="Add new variety"
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

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <SearchableSelect
                  options={[
                    ...locationOptions,
                    ...(field.value && !locationOptions.some(o => o.value === field.value)
                      ? [{ value: field.value, label: `${field.value} (retired)` }]
                      : []),
                  ]}
                  value={field.value}
                  onValueChange={field.onChange}
                  createHref="/locations"
                  placeholder="Select a location"
                  createLabel="Add new location"
                />
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
                <SearchableSelect
                  options={[
                    ...sizeOptions,
                    ...(field.value && !sizeOptions.some(o => o.value === field.value)
                      ? [{ value: field.value, label: `${field.value} (retired)` }]
                      : []),
                  ]}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    const sizeInfo = sizes.find(s => s.name === value);
                    setSelectedSizeInfo(sizeInfo as PlantSizeType ?? null);
                  }}
                  createHref="/sizes"
                  placeholder="Select a size"
                  createLabel="Add new size"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {isTrayMode && (
            <FormField
              control={form.control}
              name="trayQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tray Quantity</FormLabel>
                  <Input
                    type="number"
                    value={field.value ?? ''}
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

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={form.formState.isSubmitting || statusLoading || statusOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.systemCode} value={opt.systemCode}>
                        {opt.displayLabel}
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
                <FormLabel>Planting Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("justify-between", !field.value && "text-muted-foreground")}
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

          <FormField
            control={form.control}
            name="supplier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier</FormLabel>
                <SearchableSelect
                  options={[
                    ...supplierOptions,
                    ...(field.value && !supplierOptions.some(o => o.value === field.value)
                      ? [{ value: field.value, label: `${field.value} (retired)` }]
                      : []),
                  ]}
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  createHref="/suppliers"
                  placeholder="Select a supplier"
                  createLabel="Add new supplier"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {sourceType === "Purchase" && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-lg">Plant Passport Details</h3>
            <p className="text-sm text-muted-foreground">Required for purchased plants.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="passportBotanical"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>A - Botanical Name</FormLabel>
                    <Input {...field} value={field.value ?? ''} placeholder="e.g., Lavandula angustifolia" />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passportOperator"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>B - Operator Reg. No.</FormLabel>
                    <Input {...field} value={field.value ?? ''} placeholder="e.g., IE-12345" />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passportTraceCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>C - Traceability Code</FormLabel>
                    <Input {...field} value={field.value ?? ''} placeholder="e.g., Lot-54321" />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passportOrigin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>D - Country of Origin</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="ISO2 code, e.g., NL" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {form.formState.errors.root?.serverError && (
          <p className="text-sm font-medium text-destructive">{form.formState.errors.root.serverError.message}</p>
        )}

        <DialogFooter className="sticky bottom-0 z-10 -mx-6 px-6 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t -mb-6 pt-4 pb-4">
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
              onClick={() => onArchive(batch!.id!)}
              disabled={form.formState.isSubmitting}
            >
              Archive
            </Button>
          )}

          <Button
            type="submit"
            form="batch-form"
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
