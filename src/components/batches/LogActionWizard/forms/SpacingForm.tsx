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
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logBatchHealthEvent } from '@/app/actions/batch-health';
import { logBatchMove } from '@/app/actions/log-batch-action';

// ============================================================================
// Types
// ============================================================================

type Location = {
  id: string;
  name: string;
};

type SpacingFormProps = {
  batchId: string;
  currentQuantity?: number;
  onComplete: () => void;
  onCancel: () => void;
  setIsSubmitting: (value: boolean) => void;
};

// ============================================================================
// Schema
// ============================================================================

const SpacingFormSchema = z.object({
  notes: z.string().max(500).optional(),
  partialMove: z.boolean().default(false),
  locationId: z.string().optional(),
  quantity: z.coerce.number().int().positive().optional(),
});

type SpacingFormInput = z.infer<typeof SpacingFormSchema>;

// ============================================================================
// Component
// ============================================================================

export function SpacingForm({
  batchId,
  currentQuantity = 0,
  onComplete,
  onCancel,
  setIsSubmitting,
}: SpacingFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = React.useState(true);

  // Fetch locations on mount (like MoveForm)
  React.useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/locations?limit=200');
        const json = await res.json();
        setLocations(json.data || json.items || []);
      } catch (error) {
        // Silent fail - locations just won't be available
      } finally {
        setLocationsLoading(false);
      }
    };
    fetchLocations();
  }, []);

  const form = useForm<SpacingFormInput>({
    resolver: zodResolver(
      SpacingFormSchema.refine(
        (data) => {
          if (data.partialMove) {
            if (!data.locationId) return false;
            if (!data.quantity || data.quantity <= 0 || data.quantity > currentQuantity) return false;
          }
          return true;
        },
        {
          message: 'Location and valid quantity required for partial move',
          path: ['quantity'],
        }
      )
    ),
    defaultValues: {
      notes: '',
      partialMove: false,
      locationId: '',
      quantity: undefined,
    },
  });

  const watchPartialMove = form.watch('partialMove');

  const onSubmit = async (values: SpacingFormInput) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      // If partial move enabled, move plants first
      if (values.partialMove && values.locationId && values.quantity) {
        const moveResult = await logBatchMove({
          batchId,
          locationId: values.locationId,
          quantity: values.quantity,
          notes: `Moved ${values.quantity} plants to make room during spacing${values.notes ? `. ${values.notes}` : ''}`,
        });

        if (!moveResult.success) {
          toast.error('Failed to move plants', {
            description: moveResult.error,
          });
          return;
        }
      }

      // Log the spacing event
      const result = await logBatchHealthEvent({
        batchId,
        eventType: 'spacing',
        notes: values.partialMove && values.quantity
          ? `${values.notes || ''}\nMoved ${values.quantity} plants to new location.`.trim()
          : values.notes || undefined,
      });

      if (result.success) {
        onComplete();
      } else {
        toast.error('Failed to log spacing', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Error logging spacing', {
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
        {/* Show current quantity if available */}
        {currentQuantity > 0 && (
          <div className="text-sm text-muted-foreground">
            Current quantity: <span className="font-medium text-foreground">{currentQuantity.toLocaleString()}</span> units
          </div>
        )}

        {/* Notes */}
        <FormField
          name="notes"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Any notes about the spacing..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Partial move option */}
        {currentQuantity > 0 && (
          <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
            <FormField
              name="partialMove"
              control={form.control}
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">Move some plants to make room</p>
                    <p className="text-xs text-muted-foreground">
                      Move a portion of the batch to a different location during spacing.
                    </p>
                  </div>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />

            {watchPartialMove && (
              <>
                {/* Destination */}
                <FormField
                  name="locationId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Move to</FormLabel>
                      {locationsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading locations...
                        </div>
                      ) : locations.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No locations available.
                        </p>
                      ) : (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-[1020]">
                            {locations.map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
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
                      <FormLabel>Units to move</FormLabel>
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
                        {currentQuantity.toLocaleString()} available in batch
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </div>
        )}

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
              'Log Spacing'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default SpacingForm;
