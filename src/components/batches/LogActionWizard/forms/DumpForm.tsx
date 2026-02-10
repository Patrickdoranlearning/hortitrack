'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { logBatchDump } from '@/app/actions/log-batch-action';
import { DUMP_REASONS, type DumpReason } from '@/types/batch-actions';

// ============================================================================
// Types
// ============================================================================

type DumpFormProps = {
  batchId: string;
  currentQuantity?: number;
  onComplete: () => void;
  onCancel: () => void;
  setIsSubmitting: (value: boolean) => void;
};

// ============================================================================
// Schema
// ============================================================================

const DumpFormSchema = z.object({
  reason: z.string().min(1, 'Reason required'),
  quantity: z.coerce.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

type DumpFormInput = z.infer<typeof DumpFormSchema>;

// ============================================================================
// Component
// ============================================================================

export function DumpForm({
  batchId,
  currentQuantity = 0,
  onComplete,
  onCancel,
  setIsSubmitting,
}: DumpFormProps) {
  const [loading, setLoading] = React.useState(false);

  const form = useForm<DumpFormInput>({
    resolver: zodResolver(
      DumpFormSchema.refine(
        (data) => {
          if (data.quantity !== undefined) {
            return data.quantity > 0 && data.quantity <= currentQuantity;
          }
          return true;
        },
        {
          message: `Quantity must be between 1 and ${currentQuantity}`,
          path: ['quantity'],
        }
      )
    ),
    defaultValues: {
      reason: '',
      quantity: undefined,
      notes: '',
    },
  });

  const onSubmit = async (values: DumpFormInput) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      const result = await logBatchDump({
        batchId,
        reason: values.reason,
        quantity: values.quantity, // undefined means full batch
        notes: values.notes || undefined,
      });

      if (result.success) {
        onComplete();
      } else {
        toast.error('Failed to log dump', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Error logging dump', {
        description: String(error),
      });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Batch info */}
        <div className="text-sm text-muted-foreground">
          Current quantity: <span className="font-medium text-foreground">{currentQuantity.toLocaleString()}</span> units
        </div>

        {/* Reason */}
        <FormField
          name="reason"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.keys(DUMP_REASONS) as DumpReason[]).map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {DUMP_REASONS[reason]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quantity */}
        <FormField
          name="quantity"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity (blank = whole batch)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={currentQuantity}
                  {...field}
                  value={field.value ?? ''}
                  onFocus={(e) => e.target.select()}
                />
              </FormControl>
              <FormDescription>
                Available: {currentQuantity.toLocaleString()}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes */}
        <FormField
          name="notes"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Any additional notes about the loss..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Warning for full dump */}
        {!form.watch('quantity') && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <p className="font-medium">Entire batch will be dumped</p>
            <p className="text-xs mt-1 opacity-80">
              Leave quantity blank to dump all {currentQuantity.toLocaleString()} units. The batch will be archived.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            variant="destructive"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Logging...
              </>
            ) : (
              'Log Dump'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default DumpForm;
