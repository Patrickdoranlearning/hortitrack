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
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';
import { fetchJson } from '@/lib/http/fetchJson';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GuidePlanWithProgress } from '@/lib/planning/guide-plan-types';

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

// Get current ISO week
function getCurrentWeek(): number {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  description: z.string().max(1000).optional(),
  targetFamily: z.string().min(1, 'Target family is required'),
  targetSizeId: z.string().optional(),
  readyFromWeek: z.number().int().min(1).max(53),
  readyFromYear: z.number().int().min(2020),
  readyToWeek: z.number().int().min(1).max(53),
  readyToYear: z.number().int().min(2020),
  protocolId: z.string().optional(),
  targetQuantity: z.number().int().positive('Quantity must be positive'),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guidePlan?: GuidePlanWithProgress | null;
  onSuccess?: () => void;
};

export function GuidePlanDialog({ open, onOpenChange, guidePlan, onSuccess }: Props) {
  const { data: refData } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const [familyOpen, setFamilyOpen] = React.useState(false);
  const [protocols, setProtocols] = React.useState<Array<{ id: string; name: string }>>([]);

  const isEditing = Boolean(guidePlan?.id);
  const currentYear = new Date().getFullYear();
  const currentWeek = getCurrentWeek();

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
      name: '',
      description: '',
      targetFamily: '',
      targetSizeId: '',
      readyFromWeek: currentWeek,
      readyFromYear: currentYear,
      readyToWeek: currentWeek + 4 > 52 ? (currentWeek + 4) % 52 : currentWeek + 4,
      readyToYear: currentWeek + 4 > 52 ? currentYear + 1 : currentYear,
      protocolId: '',
      targetQuantity: 1000,
      status: 'draft',
    },
  });

  // Reset form when dialog opens/closes or guidePlan changes
  React.useEffect(() => {
    if (open) {
      if (guidePlan) {
        form.reset({
          name: guidePlan.name,
          description: guidePlan.description ?? '',
          targetFamily: guidePlan.targetFamily,
          targetSizeId: guidePlan.targetSizeId ?? '',
          readyFromWeek: guidePlan.readyFromWeek,
          readyFromYear: guidePlan.readyFromYear,
          readyToWeek: guidePlan.readyToWeek,
          readyToYear: guidePlan.readyToYear,
          protocolId: guidePlan.protocolId ?? '',
          targetQuantity: guidePlan.targetQuantity,
          status: guidePlan.status,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          targetFamily: '',
          targetSizeId: '',
          readyFromWeek: currentWeek,
          readyFromYear: currentYear,
          readyToWeek: currentWeek + 4 > 52 ? (currentWeek + 4) % 52 : currentWeek + 4,
          readyToYear: currentWeek + 4 > 52 ? currentYear + 1 : currentYear,
          protocolId: '',
          targetQuantity: 1000,
          status: 'draft',
        });
      }
    }
  }, [open, guidePlan, form, currentWeek, currentYear]);

  const sizes = refData?.sizes ?? [];
  const varieties = refData?.varieties ?? [];

  // Get unique families from varieties
  const families = React.useMemo(() => {
    const familySet = new Set<string>();
    for (const v of varieties) {
      if (v.family) {
        familySet.add(v.family);
      }
    }
    return Array.from(familySet).sort();
  }, [varieties]);

  const selectedFamily = form.watch('targetFamily');

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        description: values.description || null,
        targetFamily: values.targetFamily,
        targetSizeId: values.targetSizeId && values.targetSizeId !== OPTIONAL_VALUE ? values.targetSizeId : null,
        readyFromWeek: values.readyFromWeek,
        readyFromYear: values.readyFromYear,
        readyToWeek: values.readyToWeek,
        readyToYear: values.readyToYear,
        protocolId: values.protocolId && values.protocolId !== OPTIONAL_VALUE ? values.protocolId : null,
        targetQuantity: values.targetQuantity,
        status: values.status ?? 'draft',
      };

      if (isEditing && guidePlan?.id) {
        await fetchJson(`/api/production/guide-plans/${guidePlan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast({ title: 'Guide plan updated' });
      } else {
        await fetchJson('/api/production/guide-plans', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast({ title: 'Guide plan created' });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Failed to save guide plan',
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
            {isEditing ? 'Edit Guide Plan' : 'New Guide Plan'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the production target details.'
              : 'Create a high-level production target for a plant family and size.'}
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Erica Spring 2026" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetFamily"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Target family</FormLabel>
                      <Popover open={familyOpen} onOpenChange={setFamilyOpen}>
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
                              {field.value || 'Select family...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search families..." />
                            <CommandList>
                              <CommandEmpty>No family found. Type to use custom.</CommandEmpty>
                              <CommandGroup>
                                {families.map((family) => (
                                  <CommandItem
                                    key={family}
                                    value={family}
                                    onSelect={() => {
                                      form.setValue('targetFamily', family);
                                      setFamilyOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        field.value === family ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    {family}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        e.g. "Erica X Darleyensis", "Lavandula", "Hebe"
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
                      <FormLabel>Target size (optional)</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === OPTIONAL_VALUE ? '' : value)
                        }
                        value={field.value || OPTIONAL_VALUE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Any size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={OPTIONAL_VALUE}>Any size</SelectItem>
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
                  name="targetQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target quantity</FormLabel>
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
                        Total plants to produce for this plan
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Ready window - From */}
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

                {/* Ready window - To */}
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
                  <FormDescription className="text-xs">
                    When plants should be ready for sale
                  </FormDescription>
                </div>

                <FormField
                  control={form.control}
                  name="protocolId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipe / protocol (optional)</FormLabel>
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
                          <SelectItem value={OPTIONAL_VALUE}>No protocol</SelectItem>
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
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Additional notes about this production target..."
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
                {submitting ? 'Saving...' : isEditing ? 'Update Plan' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
