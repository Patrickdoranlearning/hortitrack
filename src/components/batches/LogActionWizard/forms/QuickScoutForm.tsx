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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Gauge, Syringe, Bug, Clock, FlaskConical, Zap, ChevronRight } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { createScoutLog, scheduleTreatment } from '@/app/actions/plant-health';
import { listIpmProducts, type IpmProduct } from '@/app/actions/ipm';
import { getRemedialProgramsForPest, applyRemedialProgram } from '@/app/actions/ipm-remedial';
import type { IpmRemedialProgram } from '@/types/ipm-remedial';

// ============================================================================
// Schema
// ============================================================================

const QuickScoutFormSchema = z.object({
  logType: z.enum(['issue', 'reading']),
  // Issue fields
  issueReason: z.string().optional(),
  severity: z.enum(['low', 'medium', 'critical']).optional(),
  // Reading fields
  ec: z.coerce.number().min(0).max(10).optional(),
  ph: z.coerce.number().min(0).max(14).optional(),
  // Treatment fields
  scheduleTreatment: z.boolean().default(false),
  treatmentProductId: z.string().optional(),
  treatmentRate: z.coerce.number().positive().optional(),
  treatmentRateUnit: z.string().optional(),
  // Common
  notes: z.string().max(500).optional(),
}).refine((data) => {
  if (data.logType === 'issue') {
    return !!data.issueReason && !!data.severity;
  }
  if (data.logType === 'reading') {
    return data.ec !== undefined || data.ph !== undefined;
  }
  return false;
}, {
  message: 'Please fill in the required fields',
}).refine((data) => {
  // If scheduling treatment, a product must be selected
  if (data.scheduleTreatment && !data.treatmentProductId) {
    return false;
  }
  return true;
}, {
  message: 'Please select a treatment product',
  path: ['treatmentProductId'],
});

type QuickScoutFormInput = z.infer<typeof QuickScoutFormSchema>;

// ============================================================================
// Types
// ============================================================================

type QuickScoutFormProps = {
  batchId: string;
  onComplete: () => void;
  onCancel: () => void;
  setIsSubmitting: (value: boolean) => void;
};

// ============================================================================
// Severity Options
// ============================================================================

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', description: 'Monitor only', color: 'bg-yellow-100 border-yellow-400 text-yellow-800' },
  { value: 'medium', label: 'Medium', description: 'Treatment needed', color: 'bg-orange-100 border-orange-400 text-orange-800' },
  { value: 'critical', label: 'Critical', description: 'Urgent action', color: 'bg-red-100 border-red-400 text-red-800' },
] as const;

// Common issue types
const ISSUE_TYPES = [
  'Aphids',
  'Whitefly',
  'Spider Mites',
  'Thrips',
  'Fungus Gnats',
  'Powdery Mildew',
  'Botrytis',
  'Root Rot',
  'Nutrient Deficiency',
  'Water Stress',
  'Heat Stress',
  'Physical Damage',
  'Other',
];

// ============================================================================
// Component
// ============================================================================

export function QuickScoutForm({
  batchId,
  onComplete,
  onCancel,
  setIsSubmitting,
}: QuickScoutFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [products, setProducts] = React.useState<IpmProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [remedialPrograms, setRemedialPrograms] = React.useState<IpmRemedialProgram[]>([]);
  const [loadingPrograms, setLoadingPrograms] = React.useState(false);
  const [applyingProgram, setApplyingProgram] = React.useState<string | null>(null);
  const productsLoadAttempted = React.useRef(false);

  const form = useForm<QuickScoutFormInput>({
    resolver: zodResolver(QuickScoutFormSchema),
    defaultValues: {
      logType: 'issue',
      severity: undefined,
      issueReason: '',
      ec: undefined,
      ph: undefined,
      scheduleTreatment: false,
      treatmentProductId: '',
      treatmentRate: undefined,
      treatmentRateUnit: 'ml/L',
      notes: '',
    },
  });

  const logType = form.watch('logType');
  const severity = form.watch('severity');
  const issueReason = form.watch('issueReason');
  const scheduleTreatmentValue = form.watch('scheduleTreatment');
  const treatmentProductId = form.watch('treatmentProductId');

  // Load remedial programs when issue reason changes
  React.useEffect(() => {
    if (issueReason && severity && (severity === 'medium' || severity === 'critical')) {
      setLoadingPrograms(true);
      getRemedialProgramsForPest(issueReason, severity).then((result) => {
        if (result.success && result.data) {
          setRemedialPrograms(result.data);
        } else {
          setRemedialPrograms([]);
        }
        setLoadingPrograms(false);
      });
    } else {
      setRemedialPrograms([]);
    }
  }, [issueReason, severity]);

  // Load IPM products when schedule treatment checkbox is enabled
  React.useEffect(() => {
    if (scheduleTreatmentValue && !productsLoadAttempted.current) {
      productsLoadAttempted.current = true;
      setLoadingProducts(true);
      listIpmProducts().then((result) => {
        if (result.success && result.data) {
          setProducts(result.data.filter((p) => p.isActive));
        }
        setLoadingProducts(false);
      });
    }
  }, [scheduleTreatmentValue]);

  // Auto-fill rate when product is selected
  React.useEffect(() => {
    if (treatmentProductId && products.length > 0) {
      const selectedProduct = products.find(p => p.id === treatmentProductId);
      if (selectedProduct?.suggestedRate) {
        form.setValue('treatmentRate', selectedProduct.suggestedRate);
        form.setValue('treatmentRateUnit', selectedProduct.suggestedRateUnit || 'ml/L');
      }
    }
  }, [treatmentProductId, products, form]);

  // Handler for applying a remedial program directly (without form submit)
  const handleApplyProgram = async (program: IpmRemedialProgram) => {
    setApplyingProgram(program.id);
    setIsSubmitting(true);

    try {
      // First log the observation
      const values = form.getValues();
      const logResult = await createScoutLog({
        batchId,
        logType: 'issue',
        issueReason: values.issueReason,
        severity: values.severity,
        notes: values.notes,
        affectedBatchIds: [batchId],
      });

      if (!logResult.success) {
        toast.error('Failed to log observation', { description: logResult.error });
        return;
      }

      // Then apply the remedial program
      const programResult = await applyRemedialProgram({
        programId: program.id,
        triggeredByLogId: logResult.data?.logId,
        targetType: 'batch',
        targetBatchId: batchId,
      });

      if (programResult.success) {
        toast.success('Issue logged & program applied', {
          description: `${program.name} treatment program started`,
        });
        onComplete();
      } else {
        toast.warning('Issue logged but program failed', {
          description: programResult.error,
        });
      }
    } catch (error) {
      toast.error('Error', { description: String(error) });
    } finally {
      setApplyingProgram(null);
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (values: QuickScoutFormInput) => {
    setLoading(true);
    setIsSubmitting(true);

    try {
      const result = await createScoutLog({
        batchId,
        logType: values.logType,
        issueReason: values.logType === 'issue' ? values.issueReason : undefined,
        severity: values.logType === 'issue' ? values.severity : undefined,
        ec: values.logType === 'reading' ? values.ec : undefined,
        ph: values.logType === 'reading' ? values.ph : undefined,
        notes: values.notes,
        affectedBatchIds: [batchId],
      });

      if (!result.success) {
        toast.error('Failed to log observation', {
          description: result.error,
        });
        return;
      }

      // Schedule treatment if requested (program mode uses handleApplyProgram button)
      if (values.scheduleTreatment && values.treatmentProductId) {
        const selectedProduct = products.find(p => p.id === values.treatmentProductId);
        const today = new Date().toISOString().split('T')[0];

        const treatmentResult = await scheduleTreatment({
          batchId,
          treatmentType: 'chemical',
          productId: values.treatmentProductId,
          productName: selectedProduct?.name,
          rate: values.treatmentRate || selectedProduct?.suggestedRate,
          rateUnit: values.treatmentRateUnit || selectedProduct?.suggestedRateUnit || 'ml/L',
          method: selectedProduct?.applicationMethods?.[0] || 'Foliar Spray',
          scheduledDate: today,
          notes: `Auto-scheduled for: ${values.issueReason}`,
          triggeredByLogId: result.data?.logId,
        });

        if (treatmentResult.success) {
          toast.success('Observation logged & treatment scheduled', {
            description: `${selectedProduct?.name} treatment scheduled for today`,
          });
        } else {
          toast.warning('Observation logged but treatment failed', {
            description: treatmentResult.error,
          });
        }
      } else {
        toast.success('Observation logged');
      }

      onComplete();
    } catch (error) {
      toast.error('Error logging observation', {
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
        {/* Log Type Toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={logType === 'issue' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => form.setValue('logType', 'issue')}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Issue
          </Button>
          <Button
            type="button"
            variant={logType === 'reading' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => form.setValue('logType', 'reading')}
          >
            <Gauge className="h-4 w-4 mr-2" />
            Reading
          </Button>
        </div>

        {/* Issue Fields */}
        {logType === 'issue' && (
          <>
            <FormField
              name="severity"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {SEVERITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => field.onChange(option.value)}
                        className={cn(
                          'p-2 rounded-lg border-2 text-center transition-all',
                          field.value === option.value
                            ? option.color
                            : 'border-muted bg-muted/30 hover:bg-muted/50'
                        )}
                      >
                        <div className="font-medium text-sm">{option.label}</div>
                        <div className="text-xs opacity-70">{option.description}</div>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="issueReason"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Type</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Select issue type...</option>
                      {ISSUE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Treatment Option - shows for medium/critical issues */}
            {(severity === 'medium' || severity === 'critical') && issueReason && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <Syringe className="h-4 w-4" />
                  Schedule Treatment
                </div>

                {/* Remedial Programs Section */}
                {loadingPrograms ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading recommended programs...
                  </div>
                ) : remedialPrograms.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Recommended programs for {issueReason}:
                    </p>
                    {remedialPrograms.map((program) => (
                      <div
                        key={program.id}
                        className="flex items-start justify-between p-2 bg-white rounded-lg border border-amber-200"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Bug className="h-3 w-3 text-amber-600 flex-shrink-0" />
                            <span className="font-medium text-sm truncate">{program.name}</span>
                            {program.treatmentUrgency === 'immediate' && (
                              <Badge variant="destructive" className="text-[10px] gap-0.5 flex-shrink-0">
                                <Zap className="h-2.5 w-2.5" />
                                Urgent
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {program.treatmentDurationDays}d
                            </span>
                            <span className="flex items-center gap-0.5">
                              <FlaskConical className="h-3 w-3" />
                              {program.steps?.length || 0} steps
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleApplyProgram(program)}
                          disabled={applyingProgram !== null || loading}
                          className="ml-2 flex-shrink-0"
                        >
                          {applyingProgram === program.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Apply
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </>
                          )}
                        </Button>
                      </div>
                    ))}

                    {/* Divider and custom product option */}
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-amber-200" />
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase">
                        <span className="bg-amber-50 px-2 text-muted-foreground">
                          or use custom product
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-1">
                    No remedial programs found for {issueReason}. Select a product below or create a program in IPM Programs.
                  </p>
                )}

                {/* Custom Product Selection */}
                <FormField
                  name="scheduleTreatment"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </FormControl>
                      <div className="space-y-0.5 flex-1">
                        <FormLabel className="font-medium text-sm">
                          Schedule single product treatment
                        </FormLabel>
                        <FormDescription className="text-xs">
                          {remedialPrograms.length > 0
                            ? 'Use a specific product instead of a program'
                            : 'Schedule a one-off treatment with a product'}
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {scheduleTreatmentValue && (
                  <>
                    <FormField
                      name="treatmentProductId"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IPM Product</FormLabel>
                          {loadingProducts ? (
                            <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading products...
                            </div>
                          ) : products.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-2">
                              No active products available
                            </div>
                          ) : (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select product..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    <div className="flex items-center gap-2">
                                      <span>{p.name}</span>
                                      {p.activeIngredient && (
                                        <span className="text-xs text-muted-foreground">
                                          ({p.activeIngredient})
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Rate field - auto-filled from product's suggested rate */}
                    {treatmentProductId && (
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          name="treatmentRate"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rate</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  placeholder="e.g., 2.5"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          name="treatmentRateUnit"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || 'ml/L'}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="ml/L">ml/L</SelectItem>
                                  <SelectItem value="g/L">g/L</SelectItem>
                                  <SelectItem value="ml/10L">ml/10L</SelectItem>
                                  <SelectItem value="g/10L">g/10L</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Reading Fields */}
        {logType === 'reading' && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="ec"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>EC (mS/cm)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="e.g., 1.8"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Normal: 0.5-3.0</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="ph"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>pH</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="14"
                      placeholder="e.g., 6.0"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Normal: 5.5-6.5</p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Notes */}
        <FormField
          name="notes"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Any additional observations..."
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
              `Log ${logType === 'issue' ? 'Issue' : 'Reading'}`
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default QuickScoutForm;
