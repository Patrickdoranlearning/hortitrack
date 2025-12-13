'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
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
  SelectItem,
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
  MapPin,
  Leaf,
  CheckCircle2,
  Beaker,
} from 'lucide-react';
import {
  listIpmProducts,
  createIpmProgram,
  updateIpmProgram,
  createIpmAssignment,
  type IpmProduct,
} from '@/app/actions/ipm';

// Product in a tank mix
const productInMixSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  rate: z.coerce.number().min(0).optional().or(z.literal('')),
  rateUnit: z.string().optional(),
  method: z.string().optional(),
});

// Week application (can have multiple products = tank mix)
const weekApplicationSchema = z.object({
  weekNumber: z.coerce.number().int().min(0, 'Week must be 0 or greater'),
  products: z.array(productInMixSchema).min(1, 'Add at least one product'),
  notes: z.string().optional(),
});

const programSchema = z.object({
  name: z.string().min(2, 'Program name required'),
  description: z.string().optional(),
  applications: z.array(weekApplicationSchema).min(1, 'Add at least one week'),
});

const assignmentSchema = z.object({
  targetType: z.enum(['family', 'location']),
  families: z.array(z.string()),
  locationIds: z.array(z.string()),
});

type ProgramFormValues = z.infer<typeof programSchema>;
type AssignmentFormValues = z.infer<typeof assignmentSchema>;

type Location = { id: string; name: string };

type IpmProgramWithSteps = {
  id: string;
  name: string;
  description?: string;
  steps?: {
    id: string;
    weekNumber: number;
    productId: string;
    rate?: number;
    rateUnit?: string;
    method?: string;
    product?: { id: string; name: string };
  }[];
};

type ProgramWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  families: string[];
  editingProgram?: IpmProgramWithSteps | null;
  onSuccess?: () => void;
};

const STEPS = [
  { id: 'details', label: 'Program Details' },
  { id: 'schedule', label: 'Week Schedule' },
  { id: 'assign', label: 'Assign Targets' },
];

const APPLICATION_METHODS = [
  'Foliar Spray',
  'Drench',
  'Bio-Control',
  'Granular',
];

export function ProgramWizard({
  open,
  onOpenChange,
  locations,
  families,
  editingProgram,
  onSuccess,
}: ProgramWizardProps) {
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<IpmProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdProgramId, setCreatedProgramId] = useState<string | null>(null);

  const isEditing = !!editingProgram;

  const programForm = useForm<ProgramFormValues>({
    resolver: zodResolver(programSchema),
    defaultValues: {
      name: '',
      description: '',
      applications: [],
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (editingProgram && open) {
      // Group steps by week number for tank mixes
      const stepsByWeek = new Map<number, typeof editingProgram.steps>();
      for (const step of editingProgram.steps || []) {
        const week = step.weekNumber ?? 0;
        if (!stepsByWeek.has(week)) {
          stepsByWeek.set(week, []);
        }
        stepsByWeek.get(week)!.push(step);
      }

      const applications: ProgramFormValues['applications'] = [];
      for (const [weekNumber, steps] of stepsByWeek.entries()) {
        applications.push({
          weekNumber,
          products: steps.map(s => ({
            productId: s.productId,
            rate: s.rate,
            rateUnit: s.rateUnit || '',
            method: s.method || '',
          })),
        });
      }
      applications.sort((a, b) => a.weekNumber - b.weekNumber);

      programForm.reset({
        name: editingProgram.name,
        description: editingProgram.description || '',
        applications,
      });
    } else if (!open) {
      // Reset when dialog closes
      programForm.reset({
        name: '',
        description: '',
        applications: [],
      });
      setStep(0);
      setCreatedProgramId(null);
    }
  }, [editingProgram, open, programForm]);

  const assignmentForm = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      targetType: 'family',
      families: [],
      locationIds: [],
    },
  });

  const { fields: weekFields, append: appendWeek, remove: removeWeek } = useFieldArray({
    control: programForm.control,
    name: 'applications',
  });

  // Load products
  useEffect(() => {
    if (open) {
      setLoadingProducts(true);
      listIpmProducts().then((result) => {
        if (result.success && result.data) {
          setProducts(result.data.filter((p) => p.isActive));
        }
        setLoadingProducts(false);
      });
    }
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(0);
      setCreatedProgramId(null);
      programForm.reset();
      assignmentForm.reset();
    }
  }, [open, programForm, assignmentForm]);

  const targetType = assignmentForm.watch('targetType');
  const selectedFamilies = assignmentForm.watch('families');
  const selectedLocations = assignmentForm.watch('locationIds');
  const applications = programForm.watch('applications');

  const canProceedStep0 = programForm.watch('name')?.length >= 2;
  const canProceedStep1 = weekFields.length > 0;
  const canProceedStep2 =
    (targetType === 'family' && selectedFamilies.length > 0) ||
    (targetType === 'location' && selectedLocations.length > 0);

  const handleNext = async () => {
    if (step === 0) {
      const valid = await programForm.trigger(['name']);
      if (valid) setStep(1);
    } else if (step === 1) {
      const valid = await programForm.trigger('applications');
      if (valid) setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const addWeekApplication = () => {
    // Find next available week number
    const usedWeeks = applications.map((a) => a.weekNumber);
    let nextWeek = 0;
    while (usedWeeks.includes(nextWeek)) {
      nextWeek++;
    }
    
    appendWeek({
      weekNumber: nextWeek,
      products: [
        {
          productId: '',
          rate: '',
          rateUnit: 'ml/L',
          method: 'Foliar Spray',
        },
      ],
      notes: '',
    });
  };

  const addProductToWeek = (weekIndex: number) => {
    const currentProducts = programForm.getValues(`applications.${weekIndex}.products`) || [];
    programForm.setValue(`applications.${weekIndex}.products`, [
      ...currentProducts,
      {
        productId: '',
        rate: '',
        rateUnit: 'ml/L',
        method: 'Foliar Spray',
      },
    ]);
  };

  const removeProductFromWeek = (weekIndex: number, productIndex: number) => {
    const currentProducts = programForm.getValues(`applications.${weekIndex}.products`) || [];
    if (currentProducts.length > 1) {
      programForm.setValue(
        `applications.${weekIndex}.products`,
        currentProducts.filter((_, i) => i !== productIndex)
      );
    }
  };

  const getProductById = (id: string) => products.find((p) => p.id === id);

  // Calculate program duration
  const programDuration = applications.length > 0
    ? Math.max(...applications.map((a) => a.weekNumber)) + 1
    : 0;

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const programValid = await programForm.trigger();
      const assignmentValid = await assignmentForm.trigger();

      if (!programValid || !assignmentValid) {
        toast.error('Please fix form errors');
        setIsSubmitting(false);
        return;
      }

      const programValues = programForm.getValues();
      const assignmentValues = assignmentForm.getValues();

      // Flatten applications into steps format for the API
      // Each product in each week becomes a step
      const steps: Array<{
        productId: string;
        rate?: number;
        rateUnit?: string;
        method?: string;
        weekNumber: number;
        notes?: string;
      }> = [];

      for (const app of programValues.applications) {
        for (const prod of app.products) {
          steps.push({
            productId: prod.productId,
            rate: typeof prod.rate === 'number' ? prod.rate : undefined,
            rateUnit: prod.rateUnit,
            method: prod.method,
            weekNumber: app.weekNumber,
            notes: app.notes,
          });
        }
      }

      // Create or update program with week-based scheduling
      const programData = {
        name: programValues.name,
        description: programValues.description,
        intervalDays: 7, // Weekly basis
        durationWeeks: programDuration,
        scheduleType: 'week_based',
        steps: steps.map((s, idx) => ({
          productId: s.productId,
          rate: s.rate,
          rateUnit: s.rateUnit,
          method: s.method,
          weekNumber: s.weekNumber,
          sortOrder: idx,
          notes: s.notes,
        })),
      };

      let programId: string;

      if (isEditing && editingProgram) {
        // Update existing program
        const programResult = await updateIpmProgram(editingProgram.id, programData);
        if (!programResult.success) {
          toast.error(programResult.error || 'Failed to update program');
          setIsSubmitting(false);
          return;
        }
        programId = editingProgram.id;
        toast.success('IPM Program updated successfully!');
      } else {
        // Create new program
        const programResult = await createIpmProgram(programData);

        if (!programResult.success || !programResult.data) {
          toast.error(programResult.error || 'Failed to create program');
          setIsSubmitting(false);
          return;
        }

        programId = programResult.data.id;
        setCreatedProgramId(programId);

        // Create assignments only for new programs
        const targets =
          assignmentValues.targetType === 'family'
            ? assignmentValues.families
            : assignmentValues.locationIds;

        for (const target of targets) {
          await createIpmAssignment({
            programId,
            targetType: assignmentValues.targetType,
            targetFamily: assignmentValues.targetType === 'family' ? target : undefined,
            targetLocationId: assignmentValues.targetType === 'location' ? target : undefined,
          });
        }

        toast.success('IPM Program created successfully!');
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create program:', error);
      toast.error('Failed to create program');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sort applications by week number for display
  const sortedApplications = [...(applications || [])].sort(
    (a, b) => a.weekNumber - b.weekNumber
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit IPM Program' : 'Create IPM Program'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the week-based treatment schedule for this program.'
              : 'Set up a week-based treatment program and assign it to families or locations.'
            }
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
          {/* Step 1: Program Details */}
          {step === 0 && (
            <Form {...programForm}>
              <div className="space-y-4">
                <FormField
                  control={programForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Spring Fungicide Program"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={programForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Optional description of this program..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Week-Based Scheduling
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Week 0 is the potting/transplant week. Set specific treatments for each week.
                    You can add multiple products to the same week for tank mixes.
                  </p>
                </div>
              </div>
            </Form>
          )}

          {/* Step 2: Week Schedule */}
          {step === 1 && (
            <Form {...programForm}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Add treatments by week. Week 0 = potting week.
                    </p>
                    {programDuration > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Program spans {programDuration} weeks
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addWeekApplication}
                    disabled={loadingProducts}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Week
                  </Button>
                </div>

                {loadingProducts ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="mt-2">Loading products...</p>
                  </div>
                ) : weekFields.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No weeks scheduled yet</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4"
                      onClick={addWeekApplication}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Week 0
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {weekFields.map((weekField, weekIndex) => {
                      const weekNumber = programForm.watch(`applications.${weekIndex}.weekNumber`);
                      const weekProducts = programForm.watch(`applications.${weekIndex}.products`) || [];
                      const isTankMix = weekProducts.length > 1;
                      
                      return (
                        <Card key={weekField.id} className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-sm font-semibold">
                                Week {weekNumber}
                              </Badge>
                              {weekNumber === 0 && (
                                <span className="text-xs text-muted-foreground">
                                  (Potting week)
                                </span>
                              )}
                              {isTankMix && (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Beaker className="h-3 w-3" />
                                  Tank Mix
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => addProductToWeek(weekIndex)}
                                className="text-xs h-7"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add to Mix
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => removeWeek(weekIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Week Number Input */}
                          <div className="mb-3">
                            <FormField
                              control={programForm.control}
                              name={`applications.${weekIndex}.weekNumber`}
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2">
                                  <FormLabel className="text-xs whitespace-nowrap">Week #</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="0"
                                      className="w-20 h-8"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Products in this week */}
                          <div className="space-y-3">
                            {weekProducts.map((_, productIndex) => {
                              const selectedProduct = getProductById(
                                programForm.watch(`applications.${weekIndex}.products.${productIndex}.productId`)
                              );
                              return (
                                <div
                                  key={productIndex}
                                  className={cn(
                                    'p-3 rounded-lg',
                                    isTankMix ? 'bg-muted/50 border' : ''
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 space-y-2">
                                      {/* Product Select */}
                                      <FormField
                                        control={programForm.control}
                                        name={`applications.${weekIndex}.products.${productIndex}.productId`}
                                        render={({ field: selectField }) => (
                                          <FormItem>
                                            <Select
                                              onValueChange={selectField.onChange}
                                              value={selectField.value}
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

                                      {/* Rate, Unit, Method */}
                                      <div className="grid grid-cols-3 gap-2">
                                        <FormField
                                          control={programForm.control}
                                          name={`applications.${weekIndex}.products.${productIndex}.rate`}
                                          render={({ field: rateField }) => (
                                            <FormItem>
                                              <FormControl>
                                                <Input
                                                  type="number"
                                                  step="0.01"
                                                  placeholder={
                                                    selectedProduct?.suggestedRate?.toString() || 'Rate'
                                                  }
                                                  className="h-8 text-sm"
                                                  {...rateField}
                                                />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                        <FormField
                                          control={programForm.control}
                                          name={`applications.${weekIndex}.products.${productIndex}.rateUnit`}
                                          render={({ field: unitField }) => (
                                            <FormItem>
                                              <Select
                                                onValueChange={unitField.onChange}
                                                value={unitField.value}
                                              >
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
                                          control={programForm.control}
                                          name={`applications.${weekIndex}.products.${productIndex}.method`}
                                          render={({ field: methodField }) => (
                                            <FormItem>
                                              <Select
                                                onValueChange={methodField.onChange}
                                                value={methodField.value}
                                              >
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
                                    
                                    {weekProducts.length > 1 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeProductFromWeek(weekIndex, productIndex)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {programForm.formState.errors.applications && (
                  <p className="text-sm text-destructive">
                    {programForm.formState.errors.applications.message}
                  </p>
                )}

                {/* Schedule Summary */}
                {sortedApplications.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="font-medium text-sm mb-2">Schedule Summary</p>
                    <div className="flex flex-wrap gap-2">
                      {sortedApplications.map((app, idx) => {
                        const productNames = app.products
                          .map((p) => getProductById(p.productId)?.name || 'Unknown')
                          .join(' + ');
                        return (
                          <Badge key={idx} variant="outline" className="text-xs">
                            W{app.weekNumber}: {productNames}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Form>
          )}

          {/* Step 3: Assign Targets */}
          {step === 2 && (
            <Form {...assignmentForm}>
              <div className="space-y-4">
                <FormField
                  control={assignmentForm.control}
                  name="targetType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign To</FormLabel>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={field.value === 'family' ? 'default' : 'outline'}
                          className="flex-1 gap-2"
                          onClick={() => field.onChange('family')}
                        >
                          <Leaf className="h-4 w-4" />
                          Plant Families
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === 'location' ? 'default' : 'outline'}
                          className="flex-1 gap-2"
                          onClick={() => field.onChange('location')}
                        >
                          <MapPin className="h-4 w-4" />
                          Locations
                        </Button>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="text-muted-foreground">
                    <strong>Week 0</strong> = each batch's potting date. Tasks will be generated 
                    automatically when batches are created.
                  </p>
                </div>

                {targetType === 'family' && (
                  <div className="space-y-2">
                    <FormLabel>Select Families ({selectedFamilies.length} selected)</FormLabel>
                    <Card className="p-3 max-h-[200px] overflow-y-auto">
                      {families.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No families available</p>
                      ) : (
                        <div className="space-y-2">
                          {families.map((family) => (
                            <label
                              key={family}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedFamilies.includes(family)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    assignmentForm.setValue('families', [
                                      ...selectedFamilies,
                                      family,
                                    ]);
                                  } else {
                                    assignmentForm.setValue(
                                      'families',
                                      selectedFamilies.filter((f) => f !== family)
                                    );
                                  }
                                }}
                              />
                              <span className="text-sm">{family}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {targetType === 'location' && (
                  <div className="space-y-2">
                    <FormLabel>Select Locations ({selectedLocations.length} selected)</FormLabel>
                    <Card className="p-3 max-h-[200px] overflow-y-auto">
                      {locations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No locations available</p>
                      ) : (
                        <div className="space-y-2">
                          {locations.map((loc) => (
                            <label
                              key={loc.id}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedLocations.includes(loc.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    assignmentForm.setValue('locationIds', [
                                      ...selectedLocations,
                                      loc.id,
                                    ]);
                                  } else {
                                    assignmentForm.setValue(
                                      'locationIds',
                                      selectedLocations.filter((id) => id !== loc.id)
                                    );
                                  }
                                }}
                              />
                              <span className="text-sm">{loc.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                )}
              </div>
            </Form>
          )}
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
              disabled={!canProceedStep2 || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Program'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
