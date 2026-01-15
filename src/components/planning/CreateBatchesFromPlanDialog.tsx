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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';
import { fetchJson } from '@/lib/http/fetchJson';
import { useToast } from '@/hooks/use-toast';
import { Info, Package } from 'lucide-react';
import type { BatchPlanWithProgress } from '@/lib/planning/guide-plan-types';
import { useTodayDate, getTodayISO } from '@/lib/date-sync';

const OPTIONAL_VALUE = '__optional__';

const schema = z.object({
  batchCount: z.number().int().min(1).max(100),
  phase: z.enum(['propagation', 'growing', 'production']),
  locationId: z.string().optional(),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  createJob: z.boolean(),
  jobName: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchPlan: BatchPlanWithProgress;
  onSuccess?: () => void;
};

export function CreateBatchesFromPlanDialog({
  open,
  onOpenChange,
  batchPlan,
  onSuccess,
}: Props) {
  const { data: refData } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  // Use hydration-safe date to prevent server/client mismatch
  const today = useTodayDate();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      batchCount: 1,
      phase: 'production',
      locationId: '',
      plannedDate: '', // Empty initially, set after hydration
      createJob: false,
      jobName: '',
    },
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        batchCount: 1,
        phase: 'production',
        locationId: '',
        plannedDate: getTodayISO(),
        createJob: false,
        jobName: '',
      });
    }
  }, [open, form]);

  // Set date after hydration when not from dialog open
  React.useEffect(() => {
    if (today && !form.getValues('plannedDate')) {
      form.setValue('plannedDate', today);
    }
  }, [today, form]);

  const locations = refData?.locations ?? [];
  const batchCount = form.watch('batchCount');
  const createJob = form.watch('createJob');

  // Calculate quantities for each batch
  const quantities = React.useMemo(() => {
    if (!batchCount || batchCount < 1) return [];
    const baseQty = Math.floor(batchPlan.plannedQuantity / batchCount);
    const remainder = batchPlan.plannedQuantity % batchCount;
    return Array.from({ length: batchCount }, (_, i) =>
      baseQty + (i < remainder ? 1 : 0)
    );
  }, [batchCount, batchPlan.plannedQuantity]);

  const remainingToCreate = batchPlan.plannedQuantity - batchPlan.progress.totalInBatches;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const result = await fetchJson<{ batches: any[]; created: number; jobId?: string }>(
        `/api/production/batch-plans/${batchPlan.id}/create-batches`,
        {
          method: 'POST',
          body: JSON.stringify({
            batchCount: values.batchCount,
            phase: values.phase,
            locationId:
              values.locationId && values.locationId !== OPTIONAL_VALUE
                ? values.locationId
                : undefined,
            plannedDate: values.plannedDate,
            createJob: values.createJob,
            jobName: values.jobName || undefined,
          }),
        }
      );

      toast({
        title: `Created ${result.created} batch${result.created !== 1 ? 'es' : ''}`,
        description: result.jobId ? 'Production job also created' : undefined,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Failed to create batches',
        description: error?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && onOpenChange(value)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create Batches
          </DialogTitle>
          <DialogDescription>
            Generate batches from batch plan for {batchPlan.plantVarietyName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Batch Plan Summary */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{batchPlan.plantVarietyName}</p>
                <p className="text-sm text-muted-foreground">
                  {batchPlan.targetSizeName ?? 'No size specified'}
                </p>
              </div>
              <Badge variant="outline">{batchPlan.status}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Planned</p>
                <p className="font-medium">{batchPlan.plannedQuantity.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">In batches</p>
                <p className="font-medium">{batchPlan.progress.totalInBatches.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Remaining</p>
                <p className="font-medium">{remainingToCreate.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {batchPlan.progress.batchCount > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {batchPlan.progress.batchCount} batch
                {batchPlan.progress.batchCount !== 1 && 'es'} already created from this plan.
                Creating more will add to the total.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="batchCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of batches</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? 1 : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {quantities.length > 0 && (
                        <span>
                          Distribution:{' '}
                          {quantities.length <= 5
                            ? quantities.map((q) => q.toLocaleString()).join(' + ')
                            : `${quantities.slice(0, 3).map((q) => q.toLocaleString()).join(' + ')} ... (${quantities.length} batches)`}
                          {' = '}
                          {batchPlan.plannedQuantity.toLocaleString()} total
                        </span>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Production phase</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select phase" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="propagation">Propagation</SelectItem>
                        <SelectItem value="growing">Growing</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (optional)</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === OPTIONAL_VALUE ? '' : value)
                      }
                      value={field.value || OPTIONAL_VALUE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Auto (Planning Backlog)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={OPTIONAL_VALUE}>Auto</SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
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
                name="plannedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Planned date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="createJob"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Create production job</FormLabel>
                      <FormDescription>
                        Group these batches into a job for tracking and assignment
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {createJob && (
                <FormField
                  control={form.control}
                  name="jobName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={`Batch Plan Execution - ${today}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? 'Creating...'
                    : `Create ${batchCount} Batch${batchCount !== 1 ? 'es' : ''}`}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
