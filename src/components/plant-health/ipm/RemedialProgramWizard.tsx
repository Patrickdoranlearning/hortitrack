'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from '@/lib/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Bug,
  Zap,
} from 'lucide-react';
import { listIpmProducts, type IpmProduct } from '@/app/actions/ipm';
import {
  createRemedialProgram,
  updateRemedialProgram,
  getRemedialPestOptionsGrouped,
  type PestOption,
} from '@/app/actions/ipm-remedial';
import type { IpmRemedialProgram } from '@/types/ipm-remedial';

// Step schema - each day can have multiple products (tank mix)
const stepSchema = z.object({
  dayOffset: z.coerce.number().int().min(0, 'Day must be 0 or greater'),
  productId: z.string().min(1, 'Select a product'),
  rate: z.coerce.number().min(0).optional().or(z.literal('')),
  rateUnit: z.string().default('ml/L'),
  method: z.string().default('Foliar Spray'),
  notes: z.string().optional(),
});

const programSchema = z.object({
  name: z.string().min(2, 'Program name required'),
  description: z.string().optional(),
  targetPestDisease: z.string().min(1, 'Select target pest/disease'),
  severityApplicability: z.array(z.string()).min(1, 'Select at least one severity'),
  treatmentDurationDays: z.coerce.number().int().min(1).default(14),
  treatmentUrgency: z.enum(['standard', 'immediate']).default('standard'),
  steps: z.array(stepSchema).min(1, 'Add at least one treatment step'),
});

type ProgramFormValues = z.infer<typeof programSchema>;

const APPLICATION_METHODS = [
  'Foliar Spray',
  'Drench',
  'Bio-Control',
  'Granular',
];

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'medium', label: 'Medium', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

const URGENCY_OPTIONS = [
  { value: 'standard', label: 'Standard', description: 'Normal treatment timeline', icon: Calendar },
  { value: 'immediate', label: 'Immediate', description: 'Urgent - start ASAP', icon: Zap },
];

type RemedialProgramWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProgram?: IpmRemedialProgram | null;
  onSuccess?: () => void;
};

const STEPS = [
  { id: 'details', label: 'Target & Details' },
  { id: 'steps', label: 'Treatment Steps' },
  { id: 'review', label: 'Review' },
];

export function RemedialProgramWizard({
  open,
  onOpenChange,
  editingProgram,
  onSuccess,
}: RemedialProgramWizardProps) {
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<IpmProduct[]>([]);
  const [pestOptions, setPestOptions] = useState<PestOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingPests, setLoadingPests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!editingProgram;

  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(programSchema),
    defaultValues: {
      name: '',
      description: '',
      targetPestDisease: '',
      severityApplicability: ['medium', 'critical'],
      treatmentDurationDays: 14,
      treatmentUrgency: 'standard',
      steps: [],
    },
  });

  const { fields: stepFields, append: appendStep, remove: removeStep } = useFieldArray({
    control: form.control,
    name: 'steps',
  });

  // Load products and pest options
  useEffect(() => {
    if (open) {
      setLoadingProducts(true);
      setLoadingPests(true);

      Promise.all([
        listIpmProducts(),
        getRemedialPestOptionsGrouped(),
      ]).then(([productsResult, pestsResult]) => {
        if (productsResult.success && productsResult.data) {
          setProducts(productsResult.data.filter((p) => p.isActive));
        }
        if (pestsResult.success && pestsResult.data) {
          setPestOptions(pestsResult.data);
        }
        setLoadingProducts(false);
        setLoadingPests(false);
      });
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (editingProgram && open) {
      form.reset({
        name: editingProgram.name,
        description: editingProgram.description || '',
        targetPestDisease: editingProgram.targetPestDisease,
        severityApplicability: editingProgram.severityApplicability || ['medium', 'critical'],
        treatmentDurationDays: editingProgram.treatmentDurationDays,
        treatmentUrgency: editingProgram.treatmentUrgency,
        steps: (editingProgram.steps || []).map((s) => ({
          dayOffset: s.dayOffset,
          productId: s.productId,
          rate: s.rate,
          rateUnit: s.rateUnit || 'ml/L',
          method: s.method || 'Foliar Spray',
          notes: s.notes || '',
        })),
      });
    } else if (!open) {
      form.reset({
        name: '',
        description: '',
        targetPestDisease: '',
        severityApplicability: ['medium', 'critical'],
        treatmentDurationDays: 14,
        treatmentUrgency: 'standard',
        steps: [],
      });
      setStep(0);
    }
  }, [editingProgram, open, form]);

  const watchedValues = form.watch();
  const canProceedStep0 =
    watchedValues.name?.length >= 2 &&
    watchedValues.targetPestDisease?.length > 0 &&
    watchedValues.severityApplicability?.length > 0;
  const canProceedStep1 = stepFields.length > 0;

  const handleNext = async () => {
    if (step === 0) {
      const valid = await form.trigger(['name', 'targetPestDisease', 'severityApplicability', 'treatmentDurationDays', 'treatmentUrgency']);
      if (valid) setStep(1);
    } else if (step === 1) {
      const valid = await form.trigger('steps');
      if (valid) setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const addStep = () => {
    // Find next available day offset (suggest Day 0, 7, 14, etc.)
    const usedDays = watchedValues.steps?.map((s) => s.dayOffset) || [];
    let nextDay = 0;
    while (usedDays.includes(nextDay)) {
      nextDay += 7;
    }

    appendStep({
      dayOffset: nextDay,
      productId: '',
      rate: '',
      rateUnit: 'ml/L',
      method: 'Foliar Spray',
      notes: '',
    });
  };

  const getProductById = (id: string) => products.find((p) => p.id === id);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const valid = await form.trigger();
      if (!valid) {
        toast.error('Please fix form errors');
        setIsSubmitting(false);
        return;
      }

      const values = form.getValues();

      const programData = {
        name: values.name,
        description: values.description,
        targetPestDisease: values.targetPestDisease,
        severityApplicability: values.severityApplicability,
        treatmentDurationDays: values.treatmentDurationDays,
        treatmentUrgency: values.treatmentUrgency as 'standard' | 'immediate',
        steps: values.steps.map((s) => ({
          dayOffset: s.dayOffset,
          productId: s.productId,
          rate: typeof s.rate === 'number' ? s.rate : undefined,
          rateUnit: s.rateUnit,
          method: s.method,
          notes: s.notes,
        })),
      };

      if (isEditing && editingProgram) {
        const result = await updateRemedialProgram(editingProgram.id, programData);
        if (!result.success) {
          toast.error(result.error || 'Failed to update program');
          setIsSubmitting(false);
          return;
        }
        toast.success('Remedial program updated!');
      } else {
        const result = await createRemedialProgram(programData);
        if (!result.success) {
          toast.error(result.error || 'Failed to create program');
          setIsSubmitting(false);
          return;
        }
        toast.success('Remedial program created!');
      }

      onSuccess?.();
      onOpenChange(false);
    } catch {
      toast.error('Failed to save program');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sort steps by day for display
  const sortedSteps = [...(watchedValues.steps || [])].sort((a, b) => a.dayOffset - b.dayOffset);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-orange-500" />
            {isEditing ? 'Edit Remedial Program' : 'Create Remedial Program'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update this pest/disease treatment protocol.'
              : 'Create a treatment protocol for a specific pest or disease.'}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 py-4">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2',
                  i < step
                    ? 'bg-primary border-primary text-primary-foreground'
                    : i === step
                      ? 'border-primary text-primary'
                      : 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {i < step ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-sm hidden sm:inline',
                  i === step ? 'font-medium' : 'text-muted-foreground'
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="w-8 h-0.5 bg-muted-foreground/30" />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-1">
          <Form {...form}>
            {/* Step 1: Target & Details */}
            {step === 0 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Standard Powdery Mildew Protocol"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetPestDisease"
                  render={({ field }) => {
                    // Group pest options by category
                    const groupedOptions = pestOptions.reduce<Record<string, PestOption[]>>((acc, opt) => {
                      const cat = opt.category || 'Other';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(opt);
                      return acc;
                    }, {});
                    const categoryOrder = ['Pest', 'Disease', 'Environmental', 'Other'];
                    const sortedCategories = Object.keys(groupedOptions).sort(
                      (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
                    );

                    return (
                      <FormItem>
                        <FormLabel>Target Pest/Disease *</FormLabel>
                        {loadingPests ? (
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading options...
                          </div>
                        ) : (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select pest or disease" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {sortedCategories.map((category) => (
                                <SelectGroup key={category}>
                                  <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    {category}
                                  </SelectLabel>
                                  {groupedOptions[category].map((opt) => (
                                    <SelectItem key={opt.label} value={opt.label}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                              {/* Allow custom entry if not in list */}
                              {field.value && !pestOptions.some((p) => p.label === field.value) && (
                                <SelectGroup>
                                  <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Custom
                                  </SelectLabel>
                                  <SelectItem value={field.value}>
                                    {field.value} (custom)
                                  </SelectItem>
                                </SelectGroup>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                        <FormDescription>
                          Programs will be suggested when this pest/disease is found during scouting.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="severityApplicability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Applicable Severity Levels *</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {SEVERITY_OPTIONS.map((sev) => (
                          <label
                            key={sev.value}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                              field.value?.includes(sev.value)
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-muted-foreground/30'
                            )}
                          >
                            <Checkbox
                              checked={field.value?.includes(sev.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, sev.value]);
                                } else {
                                  field.onChange(field.value.filter((v) => v !== sev.value));
                                }
                              }}
                            />
                            <Badge className={sev.color}>{sev.label}</Badge>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="treatmentDurationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Duration (days)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="treatmentUrgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Urgency</FormLabel>
                        <div className="flex gap-2">
                          {URGENCY_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => field.onChange(opt.value)}
                                className={cn(
                                  'flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors',
                                  field.value === opt.value
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted hover:border-muted-foreground/30'
                                )}
                              >
                                <Icon className={cn(
                                  'h-5 w-5',
                                  field.value === opt.value ? 'text-primary' : 'text-muted-foreground'
                                )} />
                                <span className="text-xs font-medium">{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Optional notes about when to use this protocol..."
                          className="min-h-[60px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 text-sm">
                  <p className="font-medium flex items-center gap-2 text-orange-800">
                    <AlertTriangle className="h-4 w-4" />
                    Remedial vs Preventative
                  </p>
                  <p className="text-orange-700 mt-1">
                    Remedial programs target specific pests found during scouting.
                    For scheduled preventative treatments, use Preventative Programs instead.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Treatment Steps */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Add treatment steps with day offsets from diagnosis.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Day 0 = treatment start date
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addStep}
                    disabled={loadingProducts}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Step
                  </Button>
                </div>

                {loadingProducts ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="mt-2">Loading products...</p>
                  </div>
                ) : stepFields.length === 0 ? (
                  <Card className="p-8 text-center">
                    <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No treatment steps yet</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4"
                      onClick={addStep}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Day 0 Treatment
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {stepFields.map((field, index) => {
                      const dayOffset = form.watch(`steps.${index}.dayOffset`);
                      const selectedProduct = getProductById(form.watch(`steps.${index}.productId`));

                      return (
                        <Card key={field.id} className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-sm font-semibold">
                                Day {dayOffset}
                              </Badge>
                              {dayOffset === 0 && (
                                <span className="text-xs text-muted-foreground">
                                  (Treatment start)
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeStep(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {/* Day Offset + Product */}
                            <div className="grid grid-cols-4 gap-2">
                              <FormField
                                control={form.control}
                                name={`steps.${index}.dayOffset`}
                                render={({ field: dayField }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Day #</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="0"
                                        className="h-9"
                                        {...dayField}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <div className="col-span-3">
                                <FormField
                                  control={form.control}
                                  name={`steps.${index}.productId`}
                                  render={({ field: productField }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Product *</FormLabel>
                                      <Select
                                        onValueChange={productField.onChange}
                                        value={productField.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select product" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {products.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                              {p.name}
                                              {p.activeIngredient && (
                                                <span className="text-muted-foreground ml-2">
                                                  ({p.activeIngredient})
                                                </span>
                                              )}
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

                            {/* Product Info */}
                            {selectedProduct && (
                              <div className="rounded bg-muted/50 p-2 text-xs">
                                <div className="flex flex-wrap gap-1">
                                  {selectedProduct.targetPests.slice(0, 3).map((pest) => (
                                    <Badge key={pest} variant="outline" className="text-[10px]">
                                      {pest}
                                    </Badge>
                                  ))}
                                  {selectedProduct.reiHours > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      REI: {selectedProduct.reiHours}h
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Rate, Unit, Method */}
                            <div className="grid grid-cols-3 gap-2">
                              <FormField
                                control={form.control}
                                name={`steps.${index}.rate`}
                                render={({ field: rateField }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Rate</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder={selectedProduct?.suggestedRate?.toString() || 'Rate'}
                                        className="h-8 text-sm"
                                        {...rateField}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`steps.${index}.rateUnit`}
                                render={({ field: unitField }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Unit</FormLabel>
                                    <Select onValueChange={unitField.onChange} value={unitField.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="ml/L">ml/L</SelectItem>
                                        <SelectItem value="g/L">g/L</SelectItem>
                                        <SelectItem value="ml/100L">ml/100L</SelectItem>
                                        <SelectItem value="g/100L">g/100L</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`steps.${index}.method`}
                                render={({ field: methodField }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Method</FormLabel>
                                    <Select onValueChange={methodField.onChange} value={methodField.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-8 text-sm">
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
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {form.formState.errors.steps && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.steps.message}
                  </p>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {step === 2 && (
              <div className="space-y-4">
                <Card className="p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <Bug className="h-4 w-4 text-orange-500" />
                    Program Summary
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{watchedValues.name}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Target</p>
                      <Badge variant="outline" className="mt-1">
                        {watchedValues.targetPestDisease}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Severity Levels</p>
                      <div className="flex gap-1 mt-1">
                        {watchedValues.severityApplicability?.map((sev) => {
                          const opt = SEVERITY_OPTIONS.find((o) => o.value === sev);
                          return opt ? (
                            <Badge key={sev} className={opt.color}>{opt.label}</Badge>
                          ) : null;
                        })}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Duration</p>
                        <p className="font-medium">{watchedValues.treatmentDurationDays} days</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Urgency</p>
                        <Badge variant={watchedValues.treatmentUrgency === 'immediate' ? 'destructive' : 'secondary'}>
                          {watchedValues.treatmentUrgency === 'immediate' ? 'Immediate' : 'Standard'}
                        </Badge>
                      </div>
                    </div>

                    {watchedValues.description && (
                      <div>
                        <p className="text-sm text-muted-foreground">Description</p>
                        <p className="text-sm">{watchedValues.description}</p>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <FlaskConical className="h-4 w-4" />
                    Treatment Schedule ({sortedSteps.length} steps)
                  </h3>

                  <div className="space-y-2">
                    {sortedSteps.map((stepData, idx) => {
                      const product = getProductById(stepData.productId);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="min-w-[60px] justify-center">
                              Day {stepData.dayOffset}
                            </Badge>
                            <span className="font-medium text-sm">
                              {product?.name || 'Unknown product'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {stepData.rate && `${stepData.rate} ${stepData.rateUnit}`}
                            {stepData.method && ` - ${stepData.method}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm">
                  <p className="text-green-800">
                    <strong>Ready to save!</strong> This program will be available when scouting
                    finds <strong>{watchedValues.targetPestDisease}</strong> issues.
                  </p>
                </div>
              </div>
            )}
          </Form>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={step === 0 || isSubmitting}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={
                (step === 0 && !canProceedStep0) || (step === 1 && !canProceedStep1)
              }
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Program' : 'Create Program'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
