'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Bug,
  Gauge,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { flagLocation, logMeasurement } from '@/app/actions/plant-health';
import { useAttributeOptions } from '@/hooks/useAttributeOptions';

const issueSchema = z.object({
  issueReason: z.string().min(1, 'Select or enter an issue'),
  severity: z.enum(['low', 'medium', 'critical']),
  notes: z.string().optional(),
  selectedBatchIds: z.array(z.string()).default([]),
});

const measurementSchema = z.object({
  ec: z.coerce.number().min(0).max(10).optional().or(z.literal('')),
  ph: z.coerce.number().min(0).max(14).optional().or(z.literal('')),
  notes: z.string().optional(),
});

type IssueFormValues = z.infer<typeof issueSchema>;
type MeasurementFormValues = z.infer<typeof measurementSchema>;

type Batch = {
  id: string;
  batchNumber: string;
  variety?: string;
  quantity?: number;
};

type ScoutLogFormProps = {
  locationId: string;
  locationName: string;
  batches: Batch[];
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function ScoutLogForm({
  locationId,
  locationName,
  batches,
  onSuccess,
  onCancel,
}: ScoutLogFormProps) {
  const [tab, setTab] = useState<string>('issue');
  
  // Get issue types from dropdown manager
  const { options: issueOptions } = useAttributeOptions('plant_health_issue');
  const [customIssue, setCustomIssue] = useState('');

  const issueForm = useForm<IssueFormValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      issueReason: '',
      severity: 'medium',
      notes: '',
      selectedBatchIds: batches.map((b) => b.id), // Default to all batches
    },
  });

  const measurementForm = useForm<MeasurementFormValues>({
    resolver: zodResolver(measurementSchema),
    defaultValues: {
      ec: '',
      ph: '',
      notes: '',
    },
  });

  const isIssueSubmitting = issueForm.formState.isSubmitting;
  const isMeasurementSubmitting = measurementForm.formState.isSubmitting;
  const selectedBatchIds = issueForm.watch('selectedBatchIds');

  const toggleBatch = (batchId: string) => {
    const current = selectedBatchIds;
    if (current.includes(batchId)) {
      issueForm.setValue('selectedBatchIds', current.filter((id) => id !== batchId));
    } else {
      issueForm.setValue('selectedBatchIds', [...current, batchId]);
    }
  };

  const selectAllBatches = () => {
    issueForm.setValue('selectedBatchIds', batches.map((b) => b.id));
  };

  const deselectAllBatches = () => {
    issueForm.setValue('selectedBatchIds', []);
  };

  async function onIssueSubmit(values: IssueFormValues) {
    try {
      const issueReason = values.issueReason === 'custom' ? customIssue : values.issueReason;
      
      if (!issueReason) {
        toast.error('Please enter an issue');
        return;
      }

      const result = await flagLocation({
        locationId,
        issueReason,
        severity: values.severity,
        notes: values.notes,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success('Issue logged', {
        description: `${issueReason} - ${values.severity} severity`,
      });

      onSuccess?.();
    } catch (error) {
      console.error('Issue logging failed', error);
      toast.error('Failed to log issue');
    }
  }

  async function onMeasurementSubmit(values: MeasurementFormValues) {
    try {
      if (values.ec === '' && values.ph === '') {
        toast.error('Enter at least one measurement');
        return;
      }

      const result = await logMeasurement({
        locationId,
        ec: values.ec !== '' ? Number(values.ec) : undefined,
        ph: values.ph !== '' ? Number(values.ph) : undefined,
        notes: values.notes,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success('Measurement recorded', {
        description: `EC: ${values.ec || '—'} | pH: ${values.ph || '—'}`,
      });

      onSuccess?.();
    } catch (error) {
      console.error('Measurement logging failed', error);
      toast.error('Failed to log measurement');
    }
  }

  const selectedIssue = issueForm.watch('issueReason');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{locationName}</h2>
          <p className="text-sm text-muted-foreground">
            {batches.length} batch{batches.length !== 1 ? 'es' : ''} present
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="issue" className="gap-2">
            <Bug className="h-4 w-4" />
            Log Issue
          </TabsTrigger>
          <TabsTrigger value="measurement" className="gap-2">
            <Gauge className="h-4 w-4" />
            Log Reading
          </TabsTrigger>
        </TabsList>

        {/* Issue Tab */}
        <TabsContent value="issue" className="mt-4">
          <Form {...issueForm}>
            <form onSubmit={issueForm.handleSubmit(onIssueSubmit)} className="space-y-4">
              {/* Issue Type */}
              <FormField
                control={issueForm.control}
                name="issueReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="What's the issue?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {issueOptions.map((opt) => (
                          <SelectItem key={opt.systemCode} value={opt.displayLabel}>
                            {opt.displayLabel}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Other (type below)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedIssue === 'custom' && (
                <FormItem>
                  <FormLabel>Describe Issue</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter custom issue..."
                      value={customIssue}
                      onChange={(e) => setCustomIssue(e.target.value)}
                    />
                  </FormControl>
                </FormItem>
              )}

              {/* Severity */}
              <FormField
                control={issueForm.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'critical'] as const).map((level) => (
                        <Button
                          key={level}
                          type="button"
                          variant={field.value === level ? 'default' : 'outline'}
                          size="sm"
                          className={
                            field.value === level
                              ? level === 'critical'
                                ? 'bg-red-600 hover:bg-red-700'
                                : level === 'medium'
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                              : ''
                          }
                          onClick={() => field.onChange(level)}
                        >
                          {level === 'low' && 'Low (Monitor)'}
                          {level === 'medium' && 'Medium (Treat)'}
                          {level === 'critical' && 'Critical (Urgent)'}
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Batch Selection */}
              {batches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <FormLabel>
                      Affected Batches ({selectedBatchIds.length}/{batches.length})
                    </FormLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={selectAllBatches}
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={deselectAllBatches}
                      >
                        None
                      </Button>
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 max-h-[150px] overflow-y-auto space-y-2">
                    {batches.map((batch) => (
                      <div key={batch.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`batch-${batch.id}`}
                          checked={selectedBatchIds.includes(batch.id)}
                          onCheckedChange={() => toggleBatch(batch.id)}
                        />
                        <label
                          htmlFor={`batch-${batch.id}`}
                          className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                        >
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{batch.batchNumber}</span>
                          {batch.variety && (
                            <span className="text-muted-foreground">— {batch.variety}</span>
                          )}
                          {batch.quantity !== undefined && (
                            <Badge variant="outline" className="text-xs ml-auto">
                              {batch.quantity}
                            </Badge>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <FormField
                control={issueForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional details, observations..."
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                    Cancel
                  </Button>
                )}
                <Button type="submit" className="flex-1 gap-2" disabled={isIssueSubmitting}>
                  {isIssueSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Logging...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      Log Issue
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* Measurement Tab */}
        <TabsContent value="measurement" className="mt-4">
          <Form {...measurementForm}>
            <form onSubmit={measurementForm.handleSubmit(onMeasurementSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={measurementForm.control}
                  name="ec"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EC Reading (mS/cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          placeholder="e.g. 1.2"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={measurementForm.control}
                  name="ph"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>pH Reading</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="14"
                          placeholder="e.g. 6.5"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Quick Reference */}
              <Card className="bg-muted/50">
                <CardContent className="p-3 text-xs space-y-1">
                  <div className="font-medium">Reference Ranges</div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>EC: 0.5–3.0 mS/cm (typical)</div>
                    <div>pH: 5.5–6.5 (most plants)</div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <FormField
                control={measurementForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Sample location, observations..."
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                    Cancel
                  </Button>
                )}
                <Button type="submit" className="flex-1 gap-2" disabled={isMeasurementSubmitting}>
                  {isMeasurementSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Record Reading
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

