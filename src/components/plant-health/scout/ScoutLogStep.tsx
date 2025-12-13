'use client';

import { useState, useRef, useCallback } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Bug,
  Gauge,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Package,
  ChevronLeft,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttributeOptions } from '@/hooks/useAttributeOptions';
import type { Batch } from './ScoutWizard';

export type LogData = {
  logType: 'issue' | 'reading';
  issue?: {
    reason: string;
    severity: 'low' | 'medium' | 'critical';
    notes?: string;
  };
  reading?: {
    ec?: number;
    ph?: number;
    notes?: string;
  };
  photoFile?: File;
  photoPreview?: string;
  selectedBatchIds: string[];
  locationId: string;
};

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

type ScoutLogStepProps = {
  locationId: string;
  locationName: string;
  batches: Batch[];
  onComplete: (data: LogData) => void;
  onBack: () => void;
};

export function ScoutLogStep({
  locationId,
  locationName,
  batches,
  onComplete,
  onBack,
}: ScoutLogStepProps) {
  const [tab, setTab] = useState<string>('issue');
  
  // Get issue types from dropdown manager
  const { options: issueOptions } = useAttributeOptions('plant_health_issue');
  const [customIssue, setCustomIssue] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const issueForm = useForm<IssueFormValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      issueReason: '',
      severity: 'medium',
      notes: '',
      selectedBatchIds: batches.map((b) => b.id),
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

  // Photo handling
  const handlePhotoSelect = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    setPhotoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (camRef.current) camRef.current.value = '';
    if (galRef.current) galRef.current.value = '';
  };

  async function onIssueSubmit(values: IssueFormValues) {
    setIsSubmitting(true);
    try {
      const issueReason = values.issueReason === 'custom' ? customIssue : values.issueReason;

      if (!issueReason) {
        toast.error('Please enter an issue');
        setIsSubmitting(false);
        return;
      }

      const logData: LogData = {
        logType: 'issue',
        issue: {
          reason: issueReason,
          severity: values.severity,
          notes: values.notes,
        },
        selectedBatchIds: values.selectedBatchIds,
        locationId,
        photoFile: photoFile || undefined,
        photoPreview: photoPreview || undefined,
      };

      onComplete(logData);
    } catch (error) {
      console.error('Issue logging failed', error);
      toast.error('Failed to prepare issue data');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onMeasurementSubmit(values: MeasurementFormValues) {
    setIsSubmitting(true);
    try {
      if (values.ec === '' && values.ph === '') {
        toast.error('Enter at least one measurement');
        setIsSubmitting(false);
        return;
      }

      const logData: LogData = {
        logType: 'reading',
        reading: {
          ec: values.ec !== '' ? Number(values.ec) : undefined,
          ph: values.ph !== '' ? Number(values.ph) : undefined,
          notes: values.notes,
        },
        selectedBatchIds: batches.map((b) => b.id), // All batches for readings
        locationId,
        photoFile: photoFile || undefined,
        photoPreview: photoPreview || undefined,
      };

      onComplete(logData);
    } catch (error) {
      console.error('Measurement logging failed', error);
      toast.error('Failed to prepare measurement data');
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedIssue = issueForm.watch('issueReason');
  const ecValue = measurementForm.watch('ec');
  const phValue = measurementForm.watch('ph');

  // Reading indicators
  const ecStatus = ecValue !== '' && typeof ecValue === 'number'
    ? ecValue < 0.5 ? 'low' : ecValue > 3.0 ? 'high' : 'normal'
    : null;
  const phStatus = phValue !== '' && typeof phValue === 'number'
    ? phValue < 5.5 ? 'low' : phValue > 6.5 ? 'high' : 'normal'
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">Step 2: Log Data</h2>
          <p className="text-sm text-muted-foreground">
            Record an issue or measurement at {locationName}
          </p>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePhotoSelect(e.target.files)}
      />
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePhotoSelect(e.target.files)}
      />

      {/* Log Type Tabs */}
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
                          className={cn(
                            'flex-1',
                            field.value === level && level === 'critical' && 'bg-red-600 hover:bg-red-700',
                            field.value === level && level === 'medium' && 'bg-amber-600 hover:bg-amber-700',
                            field.value === level && level === 'low' && 'bg-blue-600 hover:bg-blue-700'
                          )}
                          onClick={() => field.onChange(level)}
                        >
                          {level === 'low' && 'Low'}
                          {level === 'medium' && 'Medium'}
                          {level === 'critical' && 'Critical'}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {field.value === 'low' && 'Monitor only - no immediate action needed'}
                      {field.value === 'medium' && 'Treatment recommended'}
                      {field.value === 'critical' && 'Urgent action required'}
                    </p>
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
                  <div className="border rounded-lg p-3 max-h-[120px] overflow-y-auto space-y-2">
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
                          <span className="font-mono text-xs">{batch.batchNumber}</span>
                          {batch.variety && (
                            <span className="text-muted-foreground text-xs">— {batch.variety}</span>
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
                        placeholder="Additional observations..."
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Photo Capture */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Camera className="h-4 w-4" />
                    Photo (Optional)
                  </div>
                  {photoPreview && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>

                {photoPreview ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                    <img
                      src={photoPreview}
                      alt="Captured photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-16 flex-col gap-1"
                      onClick={() => camRef.current?.click()}
                    >
                      <Camera className="h-4 w-4" />
                      <span className="text-xs">Camera</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-16 flex-col gap-1"
                      onClick={() => galRef.current?.click()}
                    >
                      <ImageIcon className="h-4 w-4" />
                      <span className="text-xs">Gallery</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    Continue
                  </>
                )}
              </Button>
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
                      {ecStatus && (
                        <Badge
                          variant={ecStatus === 'normal' ? 'outline' : 'destructive'}
                          className="text-xs"
                        >
                          {ecStatus === 'low' && '⚠️ Low - needs feeding'}
                          {ecStatus === 'high' && '⚠️ High'}
                          {ecStatus === 'normal' && '✓ Normal'}
                        </Badge>
                      )}
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
                      {phStatus && (
                        <Badge
                          variant={phStatus === 'normal' ? 'outline' : 'destructive'}
                          className="text-xs"
                        >
                          {phStatus === 'low' && '⚠️ Acidic'}
                          {phStatus === 'high' && '⚠️ Alkaline'}
                          {phStatus === 'normal' && '✓ Optimal'}
                        </Badge>
                      )}
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

              {/* Photo Capture */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Camera className="h-4 w-4" />
                    Photo (Optional)
                  </div>
                  {photoPreview && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>

                {photoPreview ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                    <img
                      src={photoPreview}
                      alt="Captured photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-16 flex-col gap-1"
                      onClick={() => camRef.current?.click()}
                    >
                      <Camera className="h-4 w-4" />
                      <span className="text-xs">Camera</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-16 flex-col gap-1"
                      onClick={() => galRef.current?.click()}
                    >
                      <ImageIcon className="h-4 w-4" />
                      <span className="text-xs">Gallery</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Continue
                  </>
                )}
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

