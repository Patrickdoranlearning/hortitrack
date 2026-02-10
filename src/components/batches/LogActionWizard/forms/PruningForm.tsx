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
import {
  PruningFormSchema,
  type PruningFormInput,
  type PruningType,
  PRUNING_TYPES,
} from '@/types/batch-actions';
import { logBatchHealthEvent } from '@/app/actions/batch-health';

// ============================================================================
// Types
// ============================================================================

type PruningFormProps = {
  batchId: string;
  onComplete: () => void;
  onCancel: () => void;
  setIsSubmitting: (value: boolean) => void;
};

// ============================================================================
// Component
// ============================================================================

export function PruningForm({
  batchId,
  onComplete,
  onCancel,
  setIsSubmitting,
}: PruningFormProps) {
  const [loading, setLoading] = React.useState(false);

  const form = useForm<PruningFormInput>({
    resolver: zodResolver(PruningFormSchema),
    defaultValues: {
      pruningType: 'tip',
      notes: '',
      photoUrl: undefined,
    },
  });

  const onSubmit = async (values: PruningFormInput) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      // Build notes with pruning type
      const notesWithType = `Type: ${PRUNING_TYPES[values.pruningType as PruningType]}${values.notes ? `. ${values.notes}` : ''}`;

      const result = await logBatchHealthEvent({
        batchId,
        eventType: 'pruning',
        notes: notesWithType,
        photoUrl: values.photoUrl || undefined,
      });

      if (result.success) {
        onComplete();
      } else {
        toast.error('Failed to log pruning', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Error logging pruning', {
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
          name="pruningType"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pruning Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.keys(PRUNING_TYPES) as PruningType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {PRUNING_TYPES[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  placeholder="Any additional notes about the pruning..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* TODO: Add photo upload in future iteration */}

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
              'Log Pruning'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default PruningForm;
