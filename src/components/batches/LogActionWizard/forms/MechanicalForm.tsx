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
import { toast } from 'sonner';
import {
  MechanicalFormSchema,
  type MechanicalFormInput,
  type MechanicalActionType as MechActionType,
  MECHANICAL_ACTION_TYPES,
} from '@/types/batch-actions';
import { logBatchHealthEvent } from '@/app/actions/batch-health';

// ============================================================================
// Types
// ============================================================================

type MechanicalFormProps = {
  batchId: string;
  onComplete: () => void;
  onCancel: () => void;
  setIsSubmitting: (value: boolean) => void;
};

// ============================================================================
// Component
// ============================================================================

export function MechanicalForm({
  batchId,
  onComplete,
  onCancel,
  setIsSubmitting,
}: MechanicalFormProps) {
  const [loading, setLoading] = React.useState(false);

  const form = useForm<MechanicalFormInput>({
    resolver: zodResolver(MechanicalFormSchema),
    defaultValues: {
      actionType: 'spacing',
      notes: '',
    },
  });

  const onSubmit = async (values: MechanicalFormInput) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      // Build notes with action type
      const actionLabel = MECHANICAL_ACTION_TYPES[values.actionType as MechActionType];
      const notesWithAction = `Action: ${actionLabel}${values.notes ? `. ${values.notes}` : ''}`;

      // Use 'pruning' event type for mechanical actions (mapped to 'clearance' in db)
      // This is the correct mapping per batch-health.ts
      const result = await logBatchHealthEvent({
        batchId,
        eventType: 'pruning', // Mechanical actions use same db type as pruning (clearance)
        notes: notesWithAction,
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
          name="actionType"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Action Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.keys(MECHANICAL_ACTION_TYPES) as MechActionType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {MECHANICAL_ACTION_TYPES[type]}
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
              'Log Action'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default MechanicalForm;
