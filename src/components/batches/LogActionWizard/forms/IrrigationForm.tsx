'use client';

import * as React from 'react';
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
import { toast } from 'sonner';
import {
  IrrigationFormSchema,
  type IrrigationFormInput,
  type IrrigationMethod,
  IRRIGATION_METHODS,
} from '@/types/batch-actions';
import { logBatchHealthEvent } from '@/app/actions/batch-health';

// ============================================================================
// Types
// ============================================================================

type IrrigationFormProps = {
  batchId: string;
  onComplete: () => void;
  onCancel: () => void;
  setIsSubmitting: (value: boolean) => void;
};

// ============================================================================
// Component
// ============================================================================

export function IrrigationForm({
  batchId,
  onComplete,
  onCancel,
  setIsSubmitting,
}: IrrigationFormProps) {
  const [loading, setLoading] = React.useState(false);

  const form = useForm<IrrigationFormInput>({
    resolver: zodResolver(IrrigationFormSchema),
    defaultValues: {
      method: 'hand',
      durationMinutes: undefined,
      notes: '',
    },
  });

  const onSubmit = async (values: IrrigationFormInput) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      // Build notes with duration if provided
      const notesWithDuration = values.durationMinutes
        ? `Duration: ${values.durationMinutes} min${values.notes ? `. ${values.notes}` : ''}`
        : values.notes;

      const result = await logBatchHealthEvent({
        batchId,
        eventType: 'irrigation',
        method: IRRIGATION_METHODS[values.method as IrrigationMethod],
        notes: notesWithDuration || undefined,
      });

      if (result.success) {
        onComplete();
      } else {
        toast.error('Failed to log irrigation', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Error logging irrigation', {
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
        <FormField
          name="method"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Irrigation Method</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.keys(IRRIGATION_METHODS) as IrrigationMethod[]).map((method) => (
                    <SelectItem key={method} value={method}>
                      {IRRIGATION_METHODS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="durationMinutes"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Duration (minutes)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={480}
                  placeholder="Optional"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>Leave blank if not applicable</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="notes"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Any additional notes..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Log Irrigation'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default IrrigationForm;
