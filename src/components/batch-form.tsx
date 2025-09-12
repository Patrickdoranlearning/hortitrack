
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
import { DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import type {
  Batch,
  BatchStatus,
  PlantSize as PlantSizeType,
  Variety,
  NurseryLocation,
  Supplier,
} from '@/lib/types';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { cn } from '@/lib/utils';
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { ComboBoxEntity } from './horti/ComboBoxEntity';
import { useActiveOrg } from '@/server/org/context';
import { useCollection } from '@/hooks/useCollection';

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
  const activeOrgId = useActiveOrg();

  const ref = React.useContext(ReferenceDataContext);
  const { data: varieties } = useCollection<Variety>('varieties', ref.data?.varieties ?? []);
  const { data: sizes } = useCollection<PlantSizeType>('sizes', ref.data?.sizes ?? []);
  const { data: locations } = useCollection<NurseryLocation>('locations', ref.data?.locations ?? []);
  const { data: suppliers } = useCollection<Supplier>('suppliers', ref.data?.suppliers ?? []);
  const loading = ref.loading;

  const doranNurseries = useMemo(() => (suppliers ?? []).find(s => s.name === 'Doran Nurseries'), [suppliers]);

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
      sourceType: batch?.sourceType ?? "Propagation",
      plantVariety: batch?.plantVariety ?? '',
      plantFamily: batch?.plantFamily ?? '',
      category: batch?.category ?? '',
      size: batch?.size ?? '',
      trayQuantity: null,
      quantity: batch?.quantity ?? 0,
      status: (batch?.status as BatchStatus) ?? 'Potted',
      plantingDate: parseToDate(batch?.plantingDate),
      supplier: batch?.supplier ?? (doranNurseries?.name || ''),
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
    if (sourceType === "Propagation") {
      form.setValue('supplier', doranNurseries?.name || '');
    } else {
      if (form.getValues('supplier') === doranNurseries?.name) {
        form.setValue('supplier', '');
      }
    }
  }, [sourceType, doranNurseries, form]);

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
      status: 'Potted',
      plantingDate: new Date(),
      supplier: '',
      location: '',
      growerPhotoUrl: '',
      salesPhotoUrl: '',
    });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading options…</p>;
  }

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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-autofocus="plant-variety"><SelectValue placeholder="Select a variety" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {varietyOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    {field.value && !varietyOptions.some(o => o.value === field.value) && (
                      <SelectItem value={field.value}>{field.value} (retired)</SelectItem>
                    )}
                  </SelectContent>
                </Select>

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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {locationOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    {field.value && !locationOptions.some(o => o.value === field.value) && (
                      <SelectItem value={field.value}>{field.value} (retired)</SelectItem>
                    )}
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
                <Select onValueChange={(value) => {
                  field.onChange(value);
                  const sizeInfo = sizes.find(s => s.name === value);
                  setSelectedSizeInfo(sizeInfo as PlantSizeType ?? null);
                }} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select a size" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {sizeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    {field.value && !sizeOptions.some(o => o.value === field.value) && (
                      <SelectItem value={field.value}>{field.value} (retired)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
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
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {supplierOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                     {field.value && !supplierOptions.some(o => o.value === field.value) && (
                      <SelectItem value={field.value}>{field.value} (retired)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
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
                    <Input {...field} value={field.value ?? ''} placeholder="e.g., Lavandula angustifolia"/>
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
                    <Input {...field} value={field.value ?? ''} placeholder="e.g., IE-12345"/>
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
                    <Input {...field} value={field.value ?? ''} placeholder="e.g., Lot-54321"/>
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
                        <Input {...field} value={field.value ?? ''} placeholder="ISO2 code, e.g., NL"/>
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
