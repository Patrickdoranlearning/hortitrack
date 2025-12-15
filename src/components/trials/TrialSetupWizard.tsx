'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  FlaskConical,
  Calendar,
  Users,
  Target,
  CheckCircle2,
  Beaker,
  Leaf,
} from 'lucide-react';
import { createTrial } from '@/app/actions/trials';
import { useReferenceData } from '@/contexts/ReferenceDataContext';
import { GROUP_COLORS } from '@/types/trial';
import type { TrialSetupInput, TrialGroupInput, GroupStrategy } from '@/types/trial';

// Form schemas
const groupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  groupType: z.enum(['control', 'treatment']),
  description: z.string().optional(),
  targetPlantCount: z.coerce.number().int().min(1).default(3),
  labelColor: z.string().optional(),
  strategy: z.object({
    ipmProducts: z.array(z.object({
      id: z.string(),
      name: z.string(),
      rate: z.number().optional(),
      rateUnit: z.string().optional(),
    })).optional(),
    materials: z.array(z.object({
      id: z.string(),
      name: z.string(),
      rate: z.number().optional(),
      rateUnit: z.string().optional(),
    })).optional(),
    protocolId: z.string().optional(),
    customTreatments: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      frequency: z.string().optional(),
    })).optional(),
  }).default({}),
});

const formSchema = z.object({
  // Step 1: Basic Info
  name: z.string().min(2, 'Trial name must be at least 2 characters'),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  objective: z.string().optional(),
  methodology: z.string().optional(),
  // Step 2: Subject Selection
  varietyId: z.string().optional(),
  targetSizeId: z.string().optional(),
  trialLocationId: z.string().optional(),
  protocolId: z.string().optional(),
  // Step 3: Groups
  groups: z.array(groupSchema).min(1, 'Add at least one group'),
  // Step 5: Schedule
  startDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  measurementFrequencyDays: z.coerce.number().int().positive().default(7),
});

type FormValues = z.infer<typeof formSchema>;

const STEPS = [
  { id: 'basic', label: 'Basic Info', icon: FlaskConical },
  { id: 'subject', label: 'Subject', icon: Leaf },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'subjects', label: 'Subjects', icon: Target },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
];

export function TrialSetupWizard() {
  const router = useRouter();
  const { varieties, sizes, locations } = useReferenceData();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      hypothesis: '',
      objective: '',
      methodology: '',
      varietyId: '',
      targetSizeId: '',
      trialLocationId: '',
      protocolId: '',
      groups: [
        {
          name: 'Control',
          groupType: 'control',
          description: 'Baseline - no treatment changes',
          targetPlantCount: 3,
          labelColor: GROUP_COLORS[0].value,
          strategy: {},
        },
      ],
      startDate: '',
      plannedEndDate: '',
      measurementFrequencyDays: 7,
    },
  });

  const { fields: groupFields, append: appendGroup, remove: removeGroup } = useFieldArray({
    control: form.control,
    name: 'groups',
  });

  const groups = form.watch('groups');
  const name = form.watch('name');

  // Validation per step
  const canProceed = (currentStep: number): boolean => {
    switch (currentStep) {
      case 0:
        return name.length >= 2;
      case 1:
        return true; // Subject selection is optional
      case 2:
        return groups.length >= 1 && groups.every(g => g.name.length > 0);
      case 3:
        return true; // Subjects are auto-created
      case 4:
        return true; // Schedule is optional
      default:
        return false;
    }
  };

  const handleNext = async () => {
    let fieldsToValidate: (keyof FormValues)[] = [];

    switch (step) {
      case 0:
        fieldsToValidate = ['name'];
        break;
      case 2:
        fieldsToValidate = ['groups'];
        break;
    }

    if (fieldsToValidate.length > 0) {
      const valid = await form.trigger(fieldsToValidate);
      if (!valid) return;
    }

    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const addTreatmentGroup = () => {
    const treatmentNumber = groups.filter(g => g.groupType === 'treatment').length + 1;
    const colorIndex = (treatmentNumber % (GROUP_COLORS.length - 1)) + 1;

    appendGroup({
      name: `Treatment ${String.fromCharCode(64 + treatmentNumber)}`,
      groupType: 'treatment',
      description: '',
      targetPlantCount: 3,
      labelColor: GROUP_COLORS[colorIndex].value,
      strategy: {},
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const values = form.getValues();

      const input: TrialSetupInput = {
        name: values.name,
        description: values.description || undefined,
        hypothesis: values.hypothesis || undefined,
        objective: values.objective || undefined,
        methodology: values.methodology || undefined,
        varietyId: values.varietyId || undefined,
        targetSizeId: values.targetSizeId || undefined,
        protocolId: values.protocolId || undefined,
        trialLocationId: values.trialLocationId || undefined,
        startDate: values.startDate || undefined,
        plannedEndDate: values.plannedEndDate || undefined,
        measurementFrequencyDays: values.measurementFrequencyDays,
        groups: values.groups.map((g, i) => ({
          name: g.name,
          groupType: g.groupType,
          description: g.description || undefined,
          strategy: g.strategy as GroupStrategy,
          targetPlantCount: g.targetPlantCount,
          labelColor: g.labelColor || undefined,
        })),
      };

      const result = await createTrial(input);

      if (result.success && result.data) {
        toast.success('Trial created successfully!');
        router.push(`/plant-health/trials/${result.data.id}`);
      } else {
        toast.error(result.error || 'Failed to create trial');
      }
    } catch (error) {
      console.error('Failed to create trial:', error);
      toast.error('Failed to create trial');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSubjects = groups.reduce((sum, g) => sum + (g.targetPlantCount || 3), 0);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                    i < step
                      ? 'bg-primary border-primary text-primary-foreground'
                      : i === step
                        ? 'border-primary text-primary'
                        : 'border-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  {i < step ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-12 md:w-24 h-0.5 mx-2',
                      i < step ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'text-xs text-center w-20',
                i === step ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          {/* Step 1: Basic Info */}
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Trial Information</CardTitle>
                <CardDescription>
                  Define the basic details and scientific context for your trial
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trial Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Fertilizer A vs B on Geraniums" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of the trial..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hypothesis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hypothesis</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What do you expect to find? e.g., Treatment A will increase growth rate by 20%"
                          className="min-h-[60px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        State what you expect to discover from this trial
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Objective</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What do you want to learn? e.g., Determine optimal fertilizer concentration"
                          className="min-h-[60px]"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Subject Selection */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Trial Subject</CardTitle>
                <CardDescription>
                  Select the variety, size, and location for this trial
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="varietyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plant Variety</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select variety..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Any variety</SelectItem>
                          {varieties.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Which variety are you testing?
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetSizeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container Size</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Any size</SelectItem>
                          {sizes.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trialLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trial Location</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No specific location</SelectItem>
                          {locations.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Where will the trial take place?
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 3: Groups */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Trial Groups</CardTitle>
                    <CardDescription>
                      Define control and treatment groups
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTreatmentGroup}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Treatment
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {groupFields.map((field, index) => {
                  const group = groups[index];
                  const isControl = group?.groupType === 'control';

                  return (
                    <Card
                      key={field.id}
                      className={cn(
                        'p-4',
                        isControl && 'border-gray-300 bg-gray-50 dark:bg-gray-900/50'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: group?.labelColor || '#6B7280' }}
                          />
                          <Badge variant={isControl ? 'secondary' : 'default'}>
                            {isControl ? 'Control' : 'Treatment'}
                          </Badge>
                        </div>
                        {!isControl && groupFields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeGroup(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`groups.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Group Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Treatment A"
                                  className="h-9"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`groups.${index}.targetPlantCount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Plants per Group</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  className="h-9"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`groups.${index}.description`}
                        render={({ field }) => (
                          <FormItem className="mt-3">
                            <FormLabel className="text-xs">Treatment Strategy</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={
                                  isControl
                                    ? 'Standard treatment - no changes'
                                    : 'Describe what makes this treatment different...'
                                }
                                className="min-h-[60px] text-sm"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Color:</span>
                        <div className="flex gap-1">
                          {GROUP_COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              className={cn(
                                'w-5 h-5 rounded-full border-2',
                                group?.labelColor === color.value
                                  ? 'border-foreground'
                                  : 'border-transparent'
                              )}
                              style={{ backgroundColor: color.value }}
                              onClick={() =>
                                form.setValue(`groups.${index}.labelColor`, color.value)
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </Card>
                  );
                })}

                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="font-medium">Summary</p>
                  <p className="text-muted-foreground mt-1">
                    {groups.length} groups with {totalSubjects} total subjects
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Subjects Preview */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Trial Subjects</CardTitle>
                <CardDescription>
                  Individual plants will be created for each group
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {groups.map((group, groupIndex) => (
                  <div key={groupIndex} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.labelColor || '#6B7280' }}
                      />
                      <span className="font-medium">{group.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {group.targetPlantCount} plants
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 pl-5">
                      {Array.from({ length: group.targetPlantCount }, (_, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-center h-10 rounded border bg-muted/30 text-xs text-muted-foreground"
                        >
                          {group.name}-{i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    Auto-Generated Labels
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    Each subject will be labeled automatically (e.g., Control-1, Treatment A-2).
                    You can link subjects to batches or assign physical plant identifiers after creation.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Schedule */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>
                  Set the trial timeline and measurement frequency
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormDescription>
                          Leave blank to start as draft
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plannedEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Planned End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="measurementFrequencyDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Measurement Frequency</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(parseInt(v))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Daily</SelectItem>
                          <SelectItem value="3">Every 3 days</SelectItem>
                          <SelectItem value="7">Weekly</SelectItem>
                          <SelectItem value="14">Every 2 weeks</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How often will you record measurements?
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="font-medium">Trial Summary</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li><strong>Name:</strong> {name || 'Untitled'}</li>
                    <li><strong>Groups:</strong> {groups.length} ({groups.filter(g => g.groupType === 'control').length} control, {groups.filter(g => g.groupType === 'treatment').length} treatment)</li>
                    <li><strong>Total Subjects:</strong> {totalSubjects}</li>
                    <li><strong>Measurements:</strong> Every {form.watch('measurementFrequencyDays')} days</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
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
                disabled={!canProceed(step)}
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
                    Creating...
                  </>
                ) : (
                  <>
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Create Trial
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
