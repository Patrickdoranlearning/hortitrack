'use client';

import { useState, useEffect } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  Syringe,
  Scissors,
  Droplets,
  ChevronLeft,
  Calendar,
  AlertCircle,
  CheckCircle2,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { listIpmProducts, type IpmProduct } from '@/app/actions/ipm';
import type { LogData } from './ScoutLogStep';
import type { Batch } from './ScoutWizard';

export type TreatmentData = {
  type: 'chemical' | 'mechanical' | 'feeding';
  // Chemical
  productId?: string;
  productName?: string;
  rate?: number;
  rateUnit?: string;
  method?: string;
  applicationsTotal?: number;
  applicationIntervalDays?: number;
  // Mechanical
  mechanicalAction?: 'trimming' | 'spacing' | 'weeding' | 'removing';
  mechanicalNotes?: string;
  // Feeding
  fertilizerName?: string;
  fertilizerRate?: number;
  fertilizerUnit?: string;
  // Common
  scheduledDate: string;
  notes?: string;
};

const TREATMENT_TYPES = [
  {
    id: 'chemical' as const,
    label: 'Chemical',
    description: 'IPM products / spraying',
    icon: Syringe,
  },
  {
    id: 'mechanical' as const,
    label: 'Mechanical',
    description: 'Physical intervention',
    icon: Scissors,
  },
  {
    id: 'feeding' as const,
    label: 'Feeding',
    description: 'Nutrient application',
    icon: Droplets,
  },
];

const MECHANICAL_ACTIONS = [
  { id: 'trimming', label: 'Trimming / Pruning', description: 'Remove affected foliage' },
  { id: 'spacing', label: 'Spacing', description: 'Increase airflow between plants' },
  { id: 'weeding', label: 'Hand Weeding', description: 'Remove competing weeds' },
  { id: 'removing', label: 'Removing Plants', description: 'Remove severely infected plants' },
];

const APPLICATION_METHODS = [
  'Foliar Spray',
  'Drench',
  'Bio-Control',
  'Granular',
];

const chemicalSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  rate: z.coerce.number().min(0).optional().or(z.literal('')),
  rateUnit: z.string().default('ml/L'),
  method: z.string().default('Foliar Spray'),
  applicationsTotal: z.coerce.number().int().min(1).max(3).default(1),
  applicationIntervalDays: z.coerce.number().int().min(1).optional().or(z.literal('')),
  scheduledDate: z.string().min(1, 'Date required'),
  notes: z.string().optional(),
});

const mechanicalSchema = z.object({
  mechanicalAction: z.enum(['trimming', 'spacing', 'weeding', 'removing']),
  scheduledDate: z.string().min(1, 'Date required'),
  notes: z.string().optional(),
});

const feedingSchema = z.object({
  fertilizerName: z.string().min(1, 'Enter fertilizer name'),
  fertilizerRate: z.coerce.number().min(0).optional().or(z.literal('')),
  fertilizerUnit: z.string().default('g/L'),
  scheduledDate: z.string().min(1, 'Date required'),
  notes: z.string().optional(),
});

type ChemicalFormValues = z.infer<typeof chemicalSchema>;
type MechanicalFormValues = z.infer<typeof mechanicalSchema>;
type FeedingFormValues = z.infer<typeof feedingSchema>;

type TreatmentStepProps = {
  locationId: string;
  locationName: string;
  batches: Batch[];
  logData: LogData;
  suggestedType: 'chemical' | 'mechanical' | 'feeding' | null;
  onComplete: (data: TreatmentData) => void;
  onSkip: () => void;
  onBack: () => void;
};

export function TreatmentStep({
  locationId,
  locationName,
  batches,
  logData,
  suggestedType,
  onComplete,
  onSkip,
  onBack,
}: TreatmentStepProps) {
  const [treatmentType, setTreatmentType] = useState<'chemical' | 'mechanical' | 'feeding'>(
    suggestedType || 'chemical'
  );
  const [products, setProducts] = useState<IpmProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Load IPM products
  useEffect(() => {
    if (treatmentType === 'chemical') {
      setLoadingProducts(true);
      listIpmProducts().then((result) => {
        if (result.success && result.data) {
          setProducts(result.data.filter((p) => p.isActive));
        }
        setLoadingProducts(false);
      });
    }
  }, [treatmentType]);

  // Forms
  const chemicalForm = useForm<ChemicalFormValues>({
    resolver: zodResolver(chemicalSchema),
    defaultValues: {
      productId: '',
      rate: '',
      rateUnit: 'ml/L',
      method: 'Foliar Spray',
      applicationsTotal: 1,
      applicationIntervalDays: '',
      scheduledDate: today,
      notes: '',
    },
  });

  const mechanicalForm = useForm<MechanicalFormValues>({
    resolver: zodResolver(mechanicalSchema),
    defaultValues: {
      mechanicalAction: 'trimming',
      scheduledDate: today,
      notes: '',
    },
  });

  const feedingForm = useForm<FeedingFormValues>({
    resolver: zodResolver(feedingSchema),
    defaultValues: {
      fertilizerName: '',
      fertilizerRate: '',
      fertilizerUnit: 'g/L',
      scheduledDate: today,
      notes: '',
    },
  });

  const selectedProductId = chemicalForm.watch('productId');
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const applicationsTotal = chemicalForm.watch('applicationsTotal');

  // Reason text for context
  const reasonText = logData.logType === 'issue'
    ? `Issue: ${logData.issue?.reason} (${logData.issue?.severity})`
    : logData.reading?.ec !== undefined && logData.reading.ec < 0.5
      ? `Low EC reading: ${logData.reading.ec} mS/cm`
      : logData.reading?.ph !== undefined
        ? `pH reading: ${logData.reading.ph}`
        : 'Based on reading';

  async function onChemicalSubmit(values: ChemicalFormValues) {
    setIsSubmitting(true);
    try {
      const data: TreatmentData = {
        type: 'chemical',
        productId: values.productId,
        productName: selectedProduct?.name,
        rate: values.rate !== '' ? Number(values.rate) : undefined,
        rateUnit: values.rateUnit,
        method: values.method,
        applicationsTotal: values.applicationsTotal,
        applicationIntervalDays:
          values.applicationsTotal > 1 && values.applicationIntervalDays !== ''
            ? Number(values.applicationIntervalDays)
            : undefined,
        scheduledDate: values.scheduledDate,
        notes: values.notes,
      };
      onComplete(data);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onMechanicalSubmit(values: MechanicalFormValues) {
    setIsSubmitting(true);
    try {
      const data: TreatmentData = {
        type: 'mechanical',
        mechanicalAction: values.mechanicalAction,
        scheduledDate: values.scheduledDate,
        notes: values.notes,
      };
      onComplete(data);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onFeedingSubmit(values: FeedingFormValues) {
    setIsSubmitting(true);
    try {
      const data: TreatmentData = {
        type: 'feeding',
        fertilizerName: values.fertilizerName,
        fertilizerRate: values.fertilizerRate !== '' ? Number(values.fertilizerRate) : undefined,
        fertilizerUnit: values.fertilizerUnit,
        scheduledDate: values.scheduledDate,
        notes: values.notes,
      };
      onComplete(data);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Step 3: Schedule Treatment</h2>
          <p className="text-sm text-muted-foreground">{reasonText}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          <SkipForward className="h-4 w-4 mr-1" />
          Skip
        </Button>
      </div>

      {/* Treatment Type Selector */}
      <div className="grid grid-cols-3 gap-2">
        {TREATMENT_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = treatmentType === type.id;
          const isSuggested = suggestedType === type.id;

          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setTreatmentType(type.id)}
              className={cn(
                'relative p-3 rounded-lg border-2 text-center transition-all',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-muted-foreground/30'
              )}
            >
              {isSuggested && (
                <Badge className="absolute -top-2 -right-2 text-[10px]">
                  Suggested
                </Badge>
              )}
              <Icon className={cn('h-6 w-6 mx-auto mb-1', isSelected && 'text-primary')} />
              <p className={cn('text-sm font-medium', isSelected && 'text-primary')}>
                {type.label}
              </p>
              <p className="text-[10px] text-muted-foreground">{type.description}</p>
            </button>
          );
        })}
      </div>

      {/* Chemical Treatment Form */}
      {treatmentType === 'chemical' && (
        <Card>
          <CardContent className="p-4">
            <Form {...chemicalForm}>
              <form onSubmit={chemicalForm.handleSubmit(onChemicalSubmit)} className="space-y-4">
                {/* Product Selection */}
                <FormField
                  control={chemicalForm.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IPM Product *</FormLabel>
                      {loadingProducts ? (
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading products...
                        </div>
                      ) : products.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No active products. Add products first.
                        </div>
                      ) : (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
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

                {/* Product Info */}
                {selectedProduct && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                    {selectedProduct.targetPests.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedProduct.targetPests.slice(0, 4).map((pest) => (
                          <Badge key={pest} variant="outline" className="text-xs">
                            {pest}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {selectedProduct.reiHours > 0 && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-xs">REI: {selectedProduct.reiHours} hours</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Application Count */}
                <FormField
                  control={chemicalForm.control}
                  name="applicationsTotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Applications</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(v) => field.onChange(Number(v))}
                          value={field.value.toString()}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="1" id="app-1" />
                            <Label htmlFor="app-1">Single</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="2" id="app-2" />
                            <Label htmlFor="app-2">2x</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="3" id="app-3" />
                            <Label htmlFor="app-3">3x</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Interval (only for series) */}
                {applicationsTotal > 1 && (
                  <FormField
                    control={chemicalForm.control}
                    name="applicationIntervalDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days Between Applications</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" placeholder="e.g. 7" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {/* Rate and Method */}
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={chemicalForm.control}
                    name="rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={selectedProduct?.suggestedRate?.toString() || '—'}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={chemicalForm.control}
                    name="rateUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ml/L">ml/L</SelectItem>
                            <SelectItem value="g/L">g/L</SelectItem>
                            <SelectItem value="ml/100L">ml/100L</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={chemicalForm.control}
                    name="method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {APPLICATION_METHODS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Date */}
                <FormField
                  control={chemicalForm.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Date *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input type="date" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Notes */}
                <FormField
                  control={chemicalForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional instructions..."
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Submit */}
                <Button type="submit" className="w-full" disabled={isSubmitting || loadingProducts}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Schedule Treatment
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Mechanical Treatment Form */}
      {treatmentType === 'mechanical' && (
        <Card>
          <CardContent className="p-4">
            <Form {...mechanicalForm}>
              <form onSubmit={mechanicalForm.handleSubmit(onMechanicalSubmit)} className="space-y-4">
                {/* Action Selection */}
                <FormField
                  control={mechanicalForm.control}
                  name="mechanicalAction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Action Type *</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {MECHANICAL_ACTIONS.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => field.onChange(action.id)}
                            className={cn(
                              'p-3 rounded-lg border text-left transition-all',
                              field.value === action.id
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-muted-foreground/30'
                            )}
                          >
                            <p className="font-medium text-sm">{action.label}</p>
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date */}
                <FormField
                  control={mechanicalForm.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Date *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input type="date" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Notes */}
                <FormField
                  control={mechanicalForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional instructions..."
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Submit */}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Schedule Action
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Feeding Treatment Form */}
      {treatmentType === 'feeding' && (
        <Card>
          <CardContent className="p-4">
            <Form {...feedingForm}>
              <form onSubmit={feedingForm.handleSubmit(onFeedingSubmit)} className="space-y-4">
                {/* Fertilizer Name */}
                <FormField
                  control={feedingForm.control}
                  name="fertilizerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fertilizer / Feed *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Osmocote, Liquid Seaweed" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Rate */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={feedingForm.control}
                    name="fertilizerRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="e.g. 5" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={feedingForm.control}
                    name="fertilizerUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="g/L">g/L</SelectItem>
                            <SelectItem value="ml/L">ml/L</SelectItem>
                            <SelectItem value="g/m²">g/m²</SelectItem>
                            <SelectItem value="kg/ha">kg/ha</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Date */}
                <FormField
                  control={feedingForm.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Date *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input type="date" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Notes */}
                <FormField
                  control={feedingForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional instructions..."
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Submit */}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Schedule Feeding
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

