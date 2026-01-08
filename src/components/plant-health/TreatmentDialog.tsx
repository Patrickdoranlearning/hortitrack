'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SprayCan, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { applyLocationTreatment } from '@/app/actions/plant-health';

const formSchema = z.object({
  productName: z.string().min(2, 'Product name required'),
  rate: z.coerce.number().min(0.001, 'Rate must be positive'),
  unit: z.string().min(1, 'Unit required'),
  method: z.string().min(1, 'Method required'),
  reiHours: z.coerce.number().min(0),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const COMMON_UNITS = [
  { value: 'ml/L', label: 'ml / L (millilitres per litre)' },
  { value: 'g/L', label: 'g / L (grams per litre)' },
  { value: 'ml/10L', label: 'ml / 10L' },
  { value: 'kg/ha', label: 'kg / ha (kilograms per hectare)' },
  { value: 'L/ha', label: 'L / ha (litres per hectare)' },
  { value: '%', label: '% (percentage)' },
];

const COMMON_METHODS = [
  { value: 'Foliar Spray', label: 'Foliar Spray' },
  { value: 'Drench', label: 'Drench / Soil Application' },
  { value: 'Bio-Control', label: 'Bio-Control (beneficial insects)' },
  { value: 'Granular', label: 'Granular Application' },
  { value: 'Fumigation', label: 'Fumigation' },
  { value: 'Dusting', label: 'Dusting' },
];

const REI_OPTIONS = [
  { value: '0', label: 'No Restriction', description: 'Safe for immediate re-entry' },
  { value: '4', label: '4 Hours', description: 'Standard for mild products' },
  { value: '12', label: '12 Hours', description: 'Overnight restriction' },
  { value: '24', label: '24 Hours (Full Day)', description: 'Standard for most chemicals' },
  { value: '48', label: '48 Hours', description: 'Extended restriction' },
  { value: '72', label: '72 Hours', description: 'Severe restriction' },
];

type TreatmentDialogProps = {
  locationId: string;
  locationName: string;
  trigger?: React.ReactNode;
  onSuccess?: (count: number) => void;
};

export function TreatmentDialog({
  locationId,
  locationName,
  trigger,
  onSuccess,
}: TreatmentDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: '',
      rate: 0,
      unit: 'ml/L',
      method: 'Foliar Spray',
      reiHours: 4,
      notes: '',
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: FormValues) {
    try {
      const result = await applyLocationTreatment({
        locationId,
        productName: values.productName,
        rate: values.rate,
        unit: values.unit,
        method: values.method,
        reiHours: values.reiHours,
        notes: values.notes,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const count = result.data?.count ?? 0;
      toast.success(`Treatment applied to ${count} batch${count !== 1 ? 'es' : ''}`, {
        description:
          values.reiHours > 0
            ? `Location restricted for ${values.reiHours} hours`
            : undefined,
      });

      setOpen(false);
      form.reset();
      onSuccess?.(count);
    } catch (error) {
      console.error('Treatment application failed', error);
      toast.error('Failed to apply treatment');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive" className="gap-2">
            <SprayCan className="h-4 w-4" />
            Apply Treatment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SprayCan className="h-5 w-5" />
            Treat {locationName}
          </DialogTitle>
          <DialogDescription>
            Apply a treatment to all active batches in this location. Each batch will receive its
            own traceability record.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Product Name */}
            <FormField
              control={form.control}
              name="productName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product / Chemical</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. RoundUp, Nemasys, Fungicide X..."
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rate and Unit */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Application Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COMMON_UNITS.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Method */}
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application Method</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMMON_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Safety Lock (REI) */}
            <div className="rounded-md bg-orange-50 dark:bg-orange-950/30 p-4 border border-orange-200 dark:border-orange-900">
              <div className="flex gap-2 items-center text-orange-800 dark:text-orange-200 font-semibold mb-3">
                <AlertTriangle className="h-4 w-4" />
                <span>Safety Re-Entry Interval (REI)</span>
              </div>
              <FormField
                control={form.control}
                name="reiHours"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      defaultValue={String(field.value)}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white dark:bg-background">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REI_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{opt.label}</span>
                              <span className="text-xs text-muted-foreground">
                                — {opt.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs text-orange-700 dark:text-orange-300">
                      Location will be marked as &quot;Restricted&quot; until the REI expires.
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes about this treatment..."
                      className="resize-none"
                      rows={2}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                'Confirm Treatment'
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

