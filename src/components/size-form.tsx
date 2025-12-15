
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import type { PlantSize } from '@/lib/types';
import { PlantSizeSchema as FormSchema } from '@/lib/types'; // Rename to avoid conflict
import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const PlantSizeFormSchema = FormSchema.omit({ id: true });
type SizeFormValues = Omit<PlantSize, 'id'>;

interface SizeFormProps {
  size: PlantSize | null;
  onSubmit: (data: Omit<PlantSize, 'id'> | PlantSize) => void;
  onCancel: () => void;
}

export function SizeForm({ size, onSubmit, onCancel }: SizeFormProps) {
  const isEditing = !!size;

  // Helper to ensure numeric fields are numbers or undefined (not strings/null)
  const toNumberOrUndefined = (val: unknown): number | undefined => {
    if (val === null || val === undefined || val === '') return undefined;
    const num = Number(val);
    return Number.isNaN(num) ? undefined : num;
  };

  const form = useForm<SizeFormValues>({
    resolver: zodResolver(PlantSizeFormSchema),
    defaultValues: size
      ? {
          name: size.name ?? '',
          containerType: size.containerType ?? 'pot',
          area: toNumberOrUndefined(size.area),
          shelfQuantity: toNumberOrUndefined(size.shelfQuantity),
          cellMultiple: toNumberOrUndefined(size.cellMultiple) ?? 1,
          cellVolumeL: toNumberOrUndefined(size.cellVolumeL),
          cellDiameterMm: toNumberOrUndefined(size.cellDiameterMm),
          cellWidthMm: toNumberOrUndefined(size.cellWidthMm),
          cellLengthMm: toNumberOrUndefined(size.cellLengthMm),
          cellShape: size.cellShape,
        }
      : {
          name: '',
          containerType: 'pot',
          area: undefined,
          shelfQuantity: undefined,
          cellMultiple: 1,
          cellVolumeL: undefined,
          cellDiameterMm: undefined,
          cellWidthMm: undefined,
          cellLengthMm: undefined,
          cellShape: undefined,
        },
  });

  const widthMm = form.watch('cellWidthMm');
  const lengthMm = form.watch('cellLengthMm');

  useEffect(() => {
    form.reset(
      size
        ? {
            name: size.name ?? '',
            containerType: size.containerType ?? 'pot',
            area: toNumberOrUndefined(size.area),
            shelfQuantity: toNumberOrUndefined(size.shelfQuantity),
            cellMultiple: toNumberOrUndefined(size.cellMultiple) ?? 1,
            cellVolumeL: toNumberOrUndefined(size.cellVolumeL),
            cellDiameterMm: toNumberOrUndefined(size.cellDiameterMm),
            cellWidthMm: toNumberOrUndefined(size.cellWidthMm),
            cellLengthMm: toNumberOrUndefined(size.cellLengthMm),
            cellShape: size.cellShape,
          }
        : {
            name: '',
            containerType: 'pot',
            area: undefined,
            shelfQuantity: undefined,
            cellMultiple: 1,
            cellVolumeL: undefined,
            cellDiameterMm: undefined,
            cellWidthMm: undefined,
            cellLengthMm: undefined,
            cellShape: undefined,
          }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size?.id]);

  useEffect(() => {
    if (!widthMm || !lengthMm || Number.isNaN(widthMm) || Number.isNaN(lengthMm)) {
      if (form.getValues('area') !== undefined) {
        form.setValue('area', undefined, { shouldDirty: true });
      }
      return;
    }
    const derivedArea = Number(((widthMm * lengthMm) / 1_000_000).toFixed(4));
    if (derivedArea !== form.getValues('area')) {
      form.setValue('area', derivedArea, { shouldDirty: true });
    }
  }, [widthMm, lengthMm, form]);
  
  const handleFormSubmit = (data: SizeFormValues) => {
    if (isEditing && size) {
      onSubmit({ ...data, id: size.id });
    } else {
      onSubmit(data);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="grid max-h-[75vh] grid-rows-[auto_1fr_auto] gap-4"
        noValidate
        aria-busy={form.formState.isSubmitting}
      >
        <p className="text-sm text-muted-foreground">
          Update the golden table entry for this size. Changes impact propagation, transplant, and
          order forms immediately.
        </p>

        <div className="space-y-4 overflow-y-auto pr-1">
          <SectionCard
            title="Core details"
            description="Name and classify the container so it appears with the right defaults."
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Size / Label</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., P9, 54 Tray"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="containerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Container type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? 'pot'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pot">Pot</SelectItem>
                      <SelectItem value="tray">Tray</SelectItem>
                      <SelectItem value="bareroot">Bareroot</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shelfQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shelf quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 80"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SectionCard>

          <SectionCard
            title="Capacity & conversion"
            description="Used when calculating production output and tray-to-plant conversions."
          >
            <FormField
              control={form.control}
              name="cellMultiple"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cells / Multiple</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="e.g., 54"
                      value={field.value ?? 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        field.onChange(Number.isNaN(val) || val < 1 ? 1 : val);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cellVolumeL"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cell volume (L)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Optional"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SectionCard>

          <SectionCard
            title="Geometry"
            description="Optional measurements used when calculating space loading or pot-fit diagrams."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="cellWidthMm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cell width (mm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Optional"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cellLengthMm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cell length (mm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Optional"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="cellShape"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cell shape</FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(val === '__none' ? undefined : val)}
                    value={field.value ?? '__none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shape" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none">Not specified</SelectItem>
                      <SelectItem value="round">Round</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="area"
              render={({ field }) => (
                <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                  {widthMm && lengthMm
                    ? `Calculated area: ${((widthMm * lengthMm) / 1_000_000).toFixed(4)} m²`
                    : 'Enter both width and length (in mm) to calculate the area automatically.'}
                  <input type="hidden" value={field.value ?? ''} readOnly />
                </div>
              )}
            />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
          )}

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card/40 p-4 md:p-5">
      <div className="mb-4 space-y-1">
        <p className="font-semibold">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
