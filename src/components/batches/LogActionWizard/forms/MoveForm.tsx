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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { logBatchMove } from '@/app/actions/log-batch-action';
import { logBatchHealthEvent } from '@/app/actions/batch-health';
import { LocationComboboxGrouped, type LocationData } from '@/components/ui/location-combobox-grouped';

// ============================================================================
// Types
// ============================================================================

type MoveFormProps = {
  batchId: string;
  currentQuantity?: number;
  onComplete: () => void;
  onCancel: () => void;
  setIsSubmitting: (value: boolean) => void;
};

// ============================================================================
// Schema
// ============================================================================

const MoveFormSchema = z.object({
  locationId: z.string().min(1, 'Destination required'),
  partialMove: z.boolean().default(false),
  quantity: z.coerce.number().int().positive().optional(),
  spaced: z.boolean().default(false),
  conditionNotes: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

type MoveFormInput = z.infer<typeof MoveFormSchema>;

// ============================================================================
// Component
// ============================================================================

export function MoveForm({
  batchId,
  currentQuantity = 0,
  onComplete,
  onCancel,
  setIsSubmitting,
}: MoveFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [locations, setLocations] = React.useState<LocationData[]>([]);
  const [locationsLoading, setLocationsLoading] = React.useState(true);

  // Fetch locations on mount
  React.useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/locations?limit=200');
        const json = await res.json();
        setLocations((json.data || json.items || []).map((l: any) => ({
          id: l.id, name: l.name, nursery_site: l.nurserySite ?? l.nursery_site ?? "", is_virtual: l.isVirtual ?? l.is_virtual ?? false,
        })));
      } catch (error) {
        toast.error('Failed to load locations');
      } finally {
        setLocationsLoading(false);
      }
    };
    fetchLocations();
  }, []);

  const form = useForm<MoveFormInput>({
    resolver: zodResolver(
      MoveFormSchema.refine(
        (data) => {
          if (data.partialMove) {
            return data.quantity && data.quantity > 0 && data.quantity <= currentQuantity;
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
      locationId: '',
      partialMove: false,
      quantity: undefined,
      spaced: false,
      conditionNotes: '',
      notes: '',
    },
  });

  const watchPartialMove = form.watch('partialMove');

  const onSubmit = async (values: MoveFormInput) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      // Build combined notes
      const insights: string[] = [];
      if (values.spaced) {
        insights.push('Plants were spaced after arriving in the new location.');
      }
      if (values.partialMove) {
        insights.push('Only part of this batch was moved to the new conditions.');
      }
      if (values.conditionNotes?.trim()) {
        insights.push(`New conditions: ${values.conditionNotes.trim()}`);
      }
      const combinedNotes = [values.notes?.trim(), insights.join(' ')]
        .filter(Boolean)
        .join('\n\n');

      const result = await logBatchMove({
        batchId,
        locationId: values.locationId,
        quantity: values.partialMove ? values.quantity : undefined,
        notes: combinedNotes || undefined,
      });

      if (result.success) {
        // Log spacing as a separate care event if enabled
        if (values.spaced) {
          await logBatchHealthEvent({
            batchId,
            eventType: 'spacing',
            notes: 'Plants were spaced after move',
          });
        }
        onComplete();
      } else {
        toast.error('Failed to move batch', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Error moving batch', {
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

        {/* Destination */}
        <FormField
          name="locationId"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Destination</FormLabel>
              {locationsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading locations...
                </div>
              ) : locations.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No nursery locations available. Add one in Settings &gt; Locations.
                </p>
              ) : (
                <LocationComboboxGrouped
                  locations={locations}
                  value={field.value}
                  onSelect={field.onChange}
                  placeholder="Select location"
                  createHref="/locations"
                  excludeVirtual
                />
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Options panel */}
        <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
          {/* Spaced toggle */}
          <FormField
            name="spaced"
            control={form.control}
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">Plants were spaced after move</p>
                  <p className="text-xs text-muted-foreground">
                    Use this when trays were split or spacing was improved in the new spot.
                  </p>
                </div>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </div>
            )}
          />

          {/* Partial move toggle */}
          <FormField
            name="partialMove"
            control={form.control}
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">Move only part of the batch</p>
                  <p className="text-xs text-muted-foreground">
                    Track when a portion gets different conditions than the remainder.
                  </p>
                </div>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </div>
            )}
          />

          {/* Partial move fields */}
          {watchPartialMove && (
            <>
              <FormField
                name="quantity"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Units moved</FormLabel>
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

              <FormField
                name="conditionNotes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Describe new conditions</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Example: moved portion under shade cloth with misting 3x daily."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </div>

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
                  placeholder="Any additional notes..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || locationsLoading || locations.length === 0}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Moving...
              </>
            ) : (
              'Apply Move'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default MoveForm;
