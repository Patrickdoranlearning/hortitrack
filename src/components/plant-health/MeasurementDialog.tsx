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
import { Textarea } from '@/components/ui/textarea';
import { Gauge, Droplets, Loader2 } from 'lucide-react';
import { logMeasurement } from '@/app/actions/plant-health';

const formSchema = z
  .object({
    ec: z.coerce.number().min(0).max(10).optional().or(z.literal('')),
    ph: z.coerce.number().min(0).max(14).optional().or(z.literal('')),
    notes: z.string().optional(),
  })
  .refine((data) => data.ec !== '' || data.ph !== '', {
    message: 'At least one measurement (EC or pH) is required',
    path: ['ec'],
  });

type FormValues = z.infer<typeof formSchema>;

type MeasurementDialogProps = {
  locationId: string;
  locationName: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
};

export function MeasurementDialog({
  locationId,
  locationName,
  trigger,
  onSuccess,
}: MeasurementDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ec: '',
      ph: '',
      notes: '',
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: FormValues) {
    try {
      const result = await logMeasurement({
        locationId,
        ec: values.ec !== '' ? Number(values.ec) : undefined,
        ph: values.ph !== '' ? Number(values.ph) : undefined,
        notes: values.notes || undefined,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success('Measurement recorded', {
        description: `EC: ${values.ec || '—'} | pH: ${values.ph || '—'}`,
      });

      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Measurement logging failed', error);
      toast.error('Failed to record measurement');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" className="gap-2">
            <Gauge className="h-4 w-4" />
            Log Measurement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Log Measurement
          </DialogTitle>
          <DialogDescription>
            Record EC (electrical conductivity) and/or pH readings for {locationName}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* EC Reading */}
            <FormField
              control={form.control}
              name="ec"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    EC Reading (mS/cm)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      placeholder="e.g. 1.2"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Typical range: 0.5 - 3.0 mS/cm for most plants
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* pH Reading */}
            <FormField
              control={form.control}
              name="ph"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span className="text-green-500 font-bold text-sm">pH</span>
                    pH Reading
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="14"
                      placeholder="e.g. 6.5"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Ideal range: 5.5 - 6.5 for most plants
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quick Reference */}
            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <div className="font-medium text-muted-foreground">Quick Reference</div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>
                  <span className="font-medium">Low EC:</span> &lt; 0.5 - nutrient deficient
                </div>
                <div>
                  <span className="font-medium">High EC:</span> &gt; 3.0 - salt buildup
                </div>
                <div>
                  <span className="font-medium">Low pH:</span> &lt; 5.5 - too acidic
                </div>
                <div>
                  <span className="font-medium">High pH:</span> &gt; 7.0 - too alkaline
                </div>
              </div>
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
                      placeholder="Sample location, observations..."
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
                  Recording...
                </>
              ) : (
                'Record Measurement'
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

