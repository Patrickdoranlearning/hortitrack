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
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  GradingFormSchema,
  type GradingFormInput,
  type QualityGrade,
  QUALITY_GRADES,
} from '@/types/batch-actions';
import { logBatchHealthEvent } from '@/app/actions/batch-health';

// ============================================================================
// Types
// ============================================================================

type GradingFormProps = {
  batchId: string;
  onComplete: () => void;
  onCancel: () => void;
  setIsSubmitting: (value: boolean) => void;
};

// ============================================================================
// Component
// ============================================================================

export function GradingForm({
  batchId,
  onComplete,
  onCancel,
  setIsSubmitting,
}: GradingFormProps) {
  const [loading, setLoading] = React.useState(false);

  const form = useForm<GradingFormInput>({
    resolver: zodResolver(GradingFormSchema),
    defaultValues: {
      grade: 'standard',
      notes: '',
    },
  });

  const selectedGrade = form.watch('grade');

  const onSubmit = async (values: GradingFormInput) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      // Build notes with grade
      const gradeLabel = QUALITY_GRADES[values.grade as QualityGrade].label;
      const notesWithGrade = `Grade: ${gradeLabel}${values.notes ? `. ${values.notes}` : ''}`;

      const result = await logBatchHealthEvent({
        batchId,
        eventType: 'grading',
        notes: notesWithGrade,
      });

      if (result.success) {
        onComplete();
      } else {
        toast.error('Failed to log grading', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Error logging grading', {
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
          name="grade"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quality Grade</FormLabel>
              <FormDescription>
                Select the overall quality grade for this batch
              </FormDescription>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {(Object.keys(QUALITY_GRADES) as QualityGrade[]).map((grade) => {
                  const { label, color } = QUALITY_GRADES[grade];
                  const isSelected = field.value === grade;

                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => field.onChange(grade)}
                      className={cn(
                        'flex items-center justify-center p-3 rounded-lg border transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1'
                          : 'border-muted hover:border-primary/50',
                        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
                      )}
                    >
                      <span className={cn('font-medium', isSelected ? color : 'text-foreground')}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
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
                  placeholder="Any observations about quality..."
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
              'Log Grading'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default GradingForm;
