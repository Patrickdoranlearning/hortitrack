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
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  WeedingFormSchema,
  type WeedingFormInput,
} from '@/types/batch-actions';
import { logBatchHealthEvent } from '@/app/actions/batch-health';

// ============================================================================
// Types
// ============================================================================

type WeedingFormProps = {
  batchId: string;
  onComplete: () => void;
  onCancel: () => void;
  setIsSubmitting: (value: boolean) => void;
};

// ============================================================================
// Component
// ============================================================================

export function WeedingForm({
  batchId,
  onComplete,
  onCancel,
  setIsSubmitting,
}: WeedingFormProps) {
  const [loading, setLoading] = React.useState(false);

  const form = useForm<WeedingFormInput>({
    resolver: zodResolver(WeedingFormSchema),
    defaultValues: {
      notes: '',
    },
  });

  const onSubmit = async (values: WeedingFormInput) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      const result = await logBatchHealthEvent({
        batchId,
        eventType: 'weeding',
        notes: values.notes || undefined,
      });

      if (result.success) {
        onComplete();
      } else {
        toast.error('Failed to log action', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Error logging action', {
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
          name="notes"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Any additional notes about the weeding..."
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
              'Log Weeding'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default WeedingForm;
