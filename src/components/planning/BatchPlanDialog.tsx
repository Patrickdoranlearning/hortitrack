'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';
import { fetchJson } from '@/lib/http/fetchJson';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GuidePlanWithProgress, BatchPlanWithProgress } from '@/lib/planning/guide-plan-types';

const OPTIONAL_VALUE = '__optional__';

// Generate year options (current year + 5 years ahead)
function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => currentYear + i);
}

// Generate week options (1-52)
function getWeekOptions(): number[] {
  return Array.from({ length: 52 }, (_, i) => i + 1);
}

const schema = z.object({
  plantVarietyId: z.string().min(1, 'Variety is required'),
  targetSizeId: z.string().optional(),
  plannedQuantity: z.number().int().positive('Quantity must be positive'),
  inheritTimeline: z.boolean().optional(),
  readyFromWeek: z.number().int().min(1).max(53).optional().nullable(),
  readyFromYear: z.number().int().min(2020).optional().nullable(),
  readyToWeek: z.number().int().min(1).max(53).optional().nullable(),
  readyToYear: z.number().int().min(2020).optional().nullable(),
  protocolId: z.string().optional(),
  status: z.enum(['draft', 'active', 'completed']).optional(),
  notes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guidePlan: GuidePlanWithProgress;
  batchPlan?: BatchPlanWithProgress | null;
  onSuccess?: () => void;
};

export function BatchPlanDialog({
  open,
  onOpenChange,
  guidePlan,
  batchPlan,
  onSuccess,
}: Props) {
  const { data: refData } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const [varietyOpen, setVarietyOpen] = React.useState(false);
  const [protocols, setProtocols] = React.useState<Array<{ id: string; name: string }>>([]);

  const isEditing = Boolean(batchPlan?.id);

  // Load protocols
  React.useEffect(() => {
    if (open) {
      fetchJson<{ protocols: Array<{ id: string; name: string }> }>('/api/production/protocols')
        .then((res) => setProtocols(res.protocols ?? []))
        .catch(() => setProtocols([]));
    }
  }, [open]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plantVarietyId: '',
      targetSizeId: guidePlan.targetSizeId ?? '',
      plannedQuantity: 1000,
      inheritTimeline: true,
      readyFromWeek: null,
      readyFromYear: null,
      readyToWeek: null,
      readyToYear: null,
      protocolId: guidePlan.protocolId ?? '',
      status: 'draft',
      notes: '',
    },
  });

  const inheritTimeline = form.watch('inheritTimeline');

  // Reset form when dialog opens/closes or batchPlan changes
  React.useEffect(() => {
    if (open) {
      if (batchPlan) {
        const hasCustomTimeline = batchPlan.readyFromWeek !== null;
        form.reset({
          plantVarietyId: batchPlan.plantVarietyId,
          targetSizeId: batchPlan.targetSizeId ?? guidePlan.targetSizeId ?? '',
          plannedQuantity: batchPlan.plannedQuantity,
          inheritTimeline: !hasCustomTimeline,
          readyFromWeek: batchPlan.readyFromWeek,
          readyFromYear: batchPlan.readyFromYear,
          readyToWeek: batchPlan.readyToWeek,
          readyToYear: batchPlan.readyToYear,
          protocolId: batchPlan.protocolId ?? guidePlan.protocolId ?? '',
          status: batchPlan.status,
          notes: batchPlan.notes ?? '',
        });
      } else {
        form.reset({
          plantVarietyId: '',
          targetSizeId: guidePlan.targetSizeId ?? '',
          plannedQuantity: 1000,
          inheritTimeline: true,
          readyFromWeek: null,
          readyFromYear: null,
          readyToWeek: null,
          readyToYear: null,
          protocolId: guidePlan.protocolId ?? '',
          status: 'draft',
          notes: '',
        });
      }
    }
  }, [open, batchPlan, guidePlan, form]);

  const sizes = refData?.sizes ?? [];
  const varieties = refData?.varieties ?? [];

  // Filter varieties by guide plan's target family
  const filteredVarieties = React.useMemo(() => {
    if (!guidePlan.targetFamily) return varieties;
    return varieties.filter(
      (v) => v.family?.toLowerCase() === guidePlan.targetFamily.toLowerCase()
    );
  }, [varieties, guidePlan.targetFamily]);

  const selectedVarietyId = form.watch('plantVarietyId');
  const selectedVariety = varieties.find((v) => v.id === selectedVarietyId);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
        guidePlanId: guidePlan.id,
        plantVarietyId: values.plantVarietyId,
        targetSizeId:
          values.targetSizeId && values.targetSizeId !== OPTIONAL_VALUE
            ? values.targetSizeId
            : null,
        plannedQuantity: values.plannedQuantity,
        readyFromWeek: values.inheritTimeline ? null : values.readyFromWeek,
        readyFromYear: values.inheritTimeline ? null : values.readyFromYear,
        readyToWeek: values.inheritTimeline ? null : values.readyToWeek,
        readyToYear: values.inheritTimeline ? null : values.readyToYear,
        protocolId:
          values.protocolId && values.protocolId !== OPTIONAL_VALUE
            ? values.protocolId
            : null,
        status: values.status ?? 'draft',
        notes: values.notes || null,
      };

      if (isEditing && batchPlan?.id) {
        await fetchJson(`/api/production/batch-plans/${batchPlan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast({ title: 'Batch plan updated' });
      } else {
        await fetchJson('/api/production/batch-plans', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast({ title: 'Batch plan created' });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Failed to save batch plan',
        description: error?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && onOpenChange(value)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">
            {isEditing ? 'Edit Batch Plan' : 'New Batch Plan'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the variety-level plan details.'
              : `Add a variety breakdown for "${guidePlan.name}".`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex-1 flex flex-col overflow-hidden"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid gap-4 p-1">
                <FormField
                  control={form.control}
                  name="plantVarietyId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Variety</FormLabel>
                      <Popover open={varietyOpen} onOpenChange={setVarietyOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'justify-between',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {selectedVariety?.name || 'Select variety...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search varieties..." />
                            <CommandList>
                              <CommandEmpty>No variety found.</CommandEmpty>
                              <CommandGroup>
                                {filteredVarieties.map((v) => (
                                  <CommandItem
                                    key={v.id}
                                    value={v.name}
                                    onSelect={() => {
                                      form.setValue('plantVarietyId', v.id);
                                      setVarietyOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        field.value === v.id ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    <div>
                                      <span>{v.name}</span>
                                      {v.family && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                          ({v.family})
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        {filteredVarieties.length < varieties.length
                          ? `Filtered to ${guidePlan.targetFamily} family`
                          : 'Select the specific variety for this batch plan'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetSizeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target size</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === OPTIONAL_VALUE ? '' : value)
                        }
                        value={field.value || OPTIONAL_VALUE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Inherit from guide plan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={OPTIONAL_VALUE}>
                            {guidePlan.targetSizeName
                              ? `Inherit (${guidePlan.targetSizeName})`
                              : 'Any size'}
                          </SelectItem>
                          {sizes.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plannedQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planned quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === '' ? undefined : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Plants to produce for this variety
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inheritTimeline"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Inherit timeline from guide plan</FormLabel>
                        <FormDescription>
                          Use the ready window from the guide plan (W{guidePlan.readyFromWeek}{' '}
                          {guidePlan.readyFromYear} – W{guidePlan.readyToWeek}{' '}
                          {guidePlan.readyToYear})
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {!inheritTimeline && (
                  <>
                    <div className="space-y-2">
                      <FormLabel>Ready window (from)</FormLabel>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="readyFromWeek"
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                onValueChange={(val) => field.onChange(Number(val))}
                                value={field.value?.toString() ?? ''}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Week" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {getWeekOptions().map((week) => (
                                    <SelectItem key={week} value={week.toString()}>
                                      Week {week}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="readyFromYear"
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                onValueChange={(val) => field.onChange(Number(val))}
                                value={field.value?.toString() ?? ''}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Year" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {getYearOptions().map((year) => (
                                    <SelectItem key={year} value={year.toString()}>
                                      {year}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <FormLabel>Ready window (to)</FormLabel>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="readyToWeek"
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                onValueChange={(val) => field.onChange(Number(val))}
                                value={field.value?.toString() ?? ''}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Week" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {getWeekOptions().map((week) => (
                                    <SelectItem key={week} value={week.toString()}>
                                      Week {week}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="readyToYear"
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                onValueChange={(val) => field.onChange(Number(val))}
                                value={field.value?.toString() ?? ''}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Year" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {getYearOptions().map((year) => (
                                    <SelectItem key={year} value={year.toString()}>
                                      {year}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </>
                )}

                <FormField
                  control={form.control}
                  name="protocolId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipe / protocol</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === OPTIONAL_VALUE ? '' : value)
                        }
                        value={field.value || OPTIONAL_VALUE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No protocol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={OPTIONAL_VALUE}>
                            {guidePlan.protocolName
                              ? `Inherit (${guidePlan.protocolName})`
                              : 'No protocol'}
                          </SelectItem>
                          {protocols.map((protocol) => (
                            <SelectItem key={protocol.id} value={protocol.id}>
                              {protocol.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isEditing && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Additional notes..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="border-t pt-4 mt-4">
              <Button
                type="button"
                variant="ghost"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
