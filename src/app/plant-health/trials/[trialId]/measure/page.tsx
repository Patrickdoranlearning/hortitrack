'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  FlaskConical,
  Ruler,
  Thermometer,
  Eye,
  Package,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { getTrial, createBulkMeasurements } from '@/app/actions/trials';
import type { TrialWithRelations, TrialSubject, MeasurementInput } from '@/types/trial';
import { SCORE_LABELS, INVERSE_SCORE_LABELS } from '@/types/trial';

const STEPS = [
  { id: 'select', label: 'Select Subjects' },
  { id: 'growth', label: 'Growth Metrics' },
  { id: 'environmental', label: 'Environmental' },
  { id: 'visual', label: 'Visual Assessment' },
  { id: 'yield', label: 'Yield Data' },
  { id: 'review', label: 'Review' },
];

type SubjectMeasurement = {
  subject: TrialSubject;
  groupName: string;
  groupColor: string;
  data: Partial<MeasurementInput>;
};

export default function MeasurementPage() {
  const params = useParams();
  const router = useRouter();
  const trialId = params.trialId as string;

  const [trial, setTrial] = useState<TrialWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected subjects and their measurements
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [measurements, setMeasurements] = useState<Map<string, SubjectMeasurement>>(new Map());
  const [measurementDate, setMeasurementDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const fetchTrial = useCallback(async () => {
    setLoading(true);
    const result = await getTrial(trialId);
    if (result.success && result.data) {
      setTrial(result.data);

      // Pre-select all active subjects
      const allSubjects = result.data.groups?.flatMap((g) =>
        (g.subjects || []).filter((s) => s.isActive).map((s) => ({
          subject: s,
          groupName: g.name,
          groupColor: g.labelColor || '#6B7280',
        }))
      ) || [];

      const newMeasurements = new Map<string, SubjectMeasurement>();
      const newSelected = new Set<string>();

      for (const item of allSubjects) {
        newSelected.add(item.subject.id!);
        newMeasurements.set(item.subject.id!, {
          subject: item.subject,
          groupName: item.groupName,
          groupColor: item.groupColor,
          data: {},
        });
      }

      setSelectedSubjectIds(newSelected);
      setMeasurements(newMeasurements);
    } else {
      toast.error('Failed to load trial');
    }
    setLoading(false);
  }, [trialId]);

  useEffect(() => {
    fetchTrial();
  }, [fetchTrial]);

  const toggleSubject = (subjectId: string) => {
    const newSelected = new Set(selectedSubjectIds);
    if (newSelected.has(subjectId)) {
      newSelected.delete(subjectId);
    } else {
      newSelected.add(subjectId);
    }
    setSelectedSubjectIds(newSelected);
  };

  const updateMeasurement = (subjectId: string, field: keyof MeasurementInput, value: any) => {
    const current = measurements.get(subjectId);
    if (current) {
      const updated = {
        ...current,
        data: { ...current.data, [field]: value },
      };
      setMeasurements(new Map(measurements.set(subjectId, updated)));
    }
  };

  const applyToAll = (field: keyof MeasurementInput, value: any) => {
    const updated = new Map(measurements);
    for (const [id, m] of updated) {
      if (selectedSubjectIds.has(id)) {
        updated.set(id, { ...m, data: { ...m.data, [field]: value } });
      }
    }
    setMeasurements(updated);
  };

  const currentWeek = trial?.startDate
    ? Math.floor((Date.now() - new Date(trial.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0;

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!trial) return;
    setIsSubmitting(true);

    try {
      const measurementsToCreate: MeasurementInput[] = [];

      for (const [subjectId, m] of measurements) {
        if (selectedSubjectIds.has(subjectId)) {
          measurementsToCreate.push({
            subjectId,
            measurementDate,
            weekNumber: currentWeek,
            ...m.data,
          });
        }
      }

      const result = await createBulkMeasurements(measurementsToCreate);

      if (result.success) {
        toast.success(`Recorded ${measurementsToCreate.length} measurements`);
        router.push(`/plant-health/trials/${trialId}`);
      } else {
        toast.error(result.error || 'Failed to save measurements');
      }
    } catch (error) {
      console.error('Failed to save measurements:', error);
      toast.error('Failed to save measurements');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageFrame moduleKey="plantHealth">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageFrame>
    );
  }

  if (!trial) {
    return (
      <PageFrame moduleKey="plantHealth">
        <div className="text-center py-20">
          <FlaskConical className="h-16 w-16 mx-auto text-muted-foreground/50" />
          <p className="mt-4 text-lg text-muted-foreground">Trial not found</p>
        </div>
      </PageFrame>
    );
  }

  const selectedMeasurements = Array.from(measurements.values()).filter((m) =>
    selectedSubjectIds.has(m.subject.id!)
  );

  return (
    <PageFrame moduleKey="plantHealth">
      <div className="space-y-6">
        <ModulePageHeader
          title="Record Measurements"
          description={
            <span>
              {trial.name} • Week {currentWeek}
            </span>
          }
          actionsSlot={
            <Link href={`/plant-health/trials/${trialId}`}>
              <Button variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Trial
              </Button>
            </Link>
          }
        />

        {/* Stepper */}
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-medium shrink-0',
                  i < step
                    ? 'bg-primary border-primary text-primary-foreground'
                    : i === step
                      ? 'border-primary text-primary'
                      : 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-8 md:w-16 h-0.5 mx-1',
                    i < step ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="text-center text-sm font-medium">{STEPS[step].label}</div>

        {/* Step 0: Select Subjects */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Subjects</CardTitle>
              <CardDescription>
                Choose which subjects to record measurements for
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Label>Measurement Date</Label>
                <Input
                  type="date"
                  value={measurementDate}
                  onChange={(e) => setMeasurementDate(e.target.value)}
                  className="w-40"
                />
                <Badge variant="outline">Week {currentWeek}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedSubjectIds.size} of {measurements.size} subjects selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSubjectIds(new Set(measurements.keys()))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSubjectIds(new Set())}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              {trial.groups?.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: group.labelColor || '#6B7280' }}
                    />
                    <span className="font-medium">{group.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {group.groupType}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 pl-5">
                    {group.subjects
                      ?.filter((s) => s.isActive)
                      .map((subject) => (
                        <label
                          key={subject.id}
                          className={cn(
                            'flex items-center justify-center gap-2 h-10 rounded border cursor-pointer transition-colors text-xs',
                            selectedSubjectIds.has(subject.id!)
                              ? 'bg-primary/10 border-primary'
                              : 'bg-muted/30 hover:bg-muted/50'
                          )}
                        >
                          <Checkbox
                            checked={selectedSubjectIds.has(subject.id!)}
                            onCheckedChange={() => toggleSubject(subject.id!)}
                          />
                          {subject.label || `${group.name}-${subject.subjectNumber}`}
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 1: Growth Metrics */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                Growth Metrics
              </CardTitle>
              <CardDescription>
                Record height, leaf count, and other growth measurements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedMeasurements.map((m) => (
                  <div
                    key={m.subject.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: m.groupColor }}
                      />
                      <span className="text-sm font-medium truncate">
                        {m.subject.label || `${m.groupName}-${m.subject.subjectNumber}`}
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Height (cm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          className="h-8"
                          value={m.data.heightCm || ''}
                          onChange={(e) =>
                            updateMeasurement(
                              m.subject.id!,
                              'heightCm',
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Leaf Count</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          className="h-8"
                          value={m.data.leafCount || ''}
                          onChange={(e) =>
                            updateMeasurement(
                              m.subject.id!,
                              'leafCount',
                              e.target.value ? parseInt(e.target.value) : undefined
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Stem (mm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          className="h-8"
                          value={m.data.stemDiameterMm || ''}
                          onChange={(e) =>
                            updateMeasurement(
                              m.subject.id!,
                              'stemDiameterMm',
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Canopy (cm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          className="h-8"
                          value={m.data.canopyWidthCm || ''}
                          onChange={(e) =>
                            updateMeasurement(
                              m.subject.id!,
                              'canopyWidthCm',
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Environmental */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="h-5 w-5" />
                Environmental Readings
              </CardTitle>
              <CardDescription>
                Record EC, pH, temperature, and humidity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  Apply to all subjects
                </p>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <div>
                    <Label className="text-xs">EC (mS/cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="1.5"
                      className="h-8"
                      onChange={(e) =>
                        applyToAll('ec', e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">pH</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="6.0"
                      className="h-8"
                      onChange={(e) =>
                        applyToAll('ph', e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Temp (°C)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="20"
                      className="h-8"
                      onChange={(e) =>
                        applyToAll(
                          'temperatureC',
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Humidity (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="70"
                      className="h-8"
                      onChange={(e) =>
                        applyToAll(
                          'humidityPct',
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {selectedMeasurements.map((m) => (
                  <div
                    key={m.subject.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: m.groupColor }}
                      />
                      <span className="text-sm font-medium truncate">
                        {m.subject.label || `${m.groupName}-${m.subject.subjectNumber}`}
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="EC"
                        className="h-8 text-sm"
                        value={m.data.ec || ''}
                        onChange={(e) =>
                          updateMeasurement(
                            m.subject.id!,
                            'ec',
                            e.target.value ? parseFloat(e.target.value) : undefined
                          )
                        }
                      />
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="pH"
                        className="h-8 text-sm"
                        value={m.data.ph || ''}
                        onChange={(e) =>
                          updateMeasurement(
                            m.subject.id!,
                            'ph',
                            e.target.value ? parseFloat(e.target.value) : undefined
                          )
                        }
                      />
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Temp"
                        className="h-8 text-sm"
                        value={m.data.temperatureC || ''}
                        onChange={(e) =>
                          updateMeasurement(
                            m.subject.id!,
                            'temperatureC',
                            e.target.value ? parseFloat(e.target.value) : undefined
                          )
                        }
                      />
                      <Input
                        type="number"
                        step="1"
                        placeholder="Humidity"
                        className="h-8 text-sm"
                        value={m.data.humidityPct || ''}
                        onChange={(e) =>
                          updateMeasurement(
                            m.subject.id!,
                            'humidityPct',
                            e.target.value ? parseFloat(e.target.value) : undefined
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Visual Assessment */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Visual Assessment
              </CardTitle>
              <CardDescription>
                Rate color, vigor, pest/disease presence (1-5 scale)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedMeasurements.map((m) => (
                  <div key={m.subject.id} className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: m.groupColor }}
                      />
                      <span className="text-sm font-medium">
                        {m.subject.label || `${m.groupName}-${m.subject.subjectNumber}`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <Label className="text-xs">Color (1-5)</Label>
                        <Select
                          value={m.data.colorScore?.toString()}
                          onValueChange={(v) =>
                            updateMeasurement(m.subject.id!, 'colorScore', parseInt(v))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Score" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((score) => (
                              <SelectItem key={score} value={score.toString()}>
                                {score} - {SCORE_LABELS[score as keyof typeof SCORE_LABELS]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Vigor (1-5)</Label>
                        <Select
                          value={m.data.vigorScore?.toString()}
                          onValueChange={(v) =>
                            updateMeasurement(m.subject.id!, 'vigorScore', parseInt(v))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Score" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((score) => (
                              <SelectItem key={score} value={score.toString()}>
                                {score} - {SCORE_LABELS[score as keyof typeof SCORE_LABELS]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Pest (5=none)</Label>
                        <Select
                          value={m.data.pestScore?.toString()}
                          onValueChange={(v) =>
                            updateMeasurement(m.subject.id!, 'pestScore', parseInt(v))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Score" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((score) => (
                              <SelectItem key={score} value={score.toString()}>
                                {score} -{' '}
                                {INVERSE_SCORE_LABELS[score as keyof typeof INVERSE_SCORE_LABELS]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Disease (5=none)</Label>
                        <Select
                          value={m.data.diseaseScore?.toString()}
                          onValueChange={(v) =>
                            updateMeasurement(m.subject.id!, 'diseaseScore', parseInt(v))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Score" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((score) => (
                              <SelectItem key={score} value={score.toString()}>
                                {score} -{' '}
                                {INVERSE_SCORE_LABELS[score as keyof typeof INVERSE_SCORE_LABELS]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Overall (1-5)</Label>
                        <Select
                          value={m.data.overallHealthScore?.toString()}
                          onValueChange={(v) =>
                            updateMeasurement(m.subject.id!, 'overallHealthScore', parseInt(v))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Score" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((score) => (
                              <SelectItem key={score} value={score.toString()}>
                                {score} - {SCORE_LABELS[score as keyof typeof SCORE_LABELS]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Yield Data */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Yield Data
              </CardTitle>
              <CardDescription>
                Record flower/fruit counts, harvest weight, and quality grade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedMeasurements.map((m) => (
                  <div
                    key={m.subject.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: m.groupColor }}
                      />
                      <span className="text-sm font-medium truncate">
                        {m.subject.label || `${m.groupName}-${m.subject.subjectNumber}`}
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Flowers</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          className="h-8"
                          value={m.data.flowersCount || ''}
                          onChange={(e) =>
                            updateMeasurement(
                              m.subject.id!,
                              'flowersCount',
                              e.target.value ? parseInt(e.target.value) : undefined
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Fruits</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          className="h-8"
                          value={m.data.fruitsCount || ''}
                          onChange={(e) =>
                            updateMeasurement(
                              m.subject.id!,
                              'fruitsCount',
                              e.target.value ? parseInt(e.target.value) : undefined
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Weight (g)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          className="h-8"
                          value={m.data.harvestWeightG || ''}
                          onChange={(e) =>
                            updateMeasurement(
                              m.subject.id!,
                              'harvestWeightG',
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Grade</Label>
                        <Select
                          value={m.data.qualityGrade || ''}
                          onValueChange={(v) =>
                            updateMeasurement(m.subject.id!, 'qualityGrade', v || undefined)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Grade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">A - Premium</SelectItem>
                            <SelectItem value="B">B - Good</SelectItem>
                            <SelectItem value="C">C - Fair</SelectItem>
                            <SelectItem value="cull">Cull</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Save</CardTitle>
              <CardDescription>
                Review measurements before saving
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium">Measurement Summary</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>
                      <strong>Date:</strong> {measurementDate}
                    </li>
                    <li>
                      <strong>Week:</strong> {currentWeek}
                    </li>
                    <li>
                      <strong>Subjects:</strong> {selectedSubjectIds.size}
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  {selectedMeasurements.map((m) => {
                    const hasData = Object.values(m.data).some((v) => v !== undefined && v !== '');

                    return (
                      <div
                        key={m.subject.id}
                        className={cn(
                          'p-3 rounded-lg border',
                          hasData ? 'bg-green-50 dark:bg-green-950/20' : 'bg-muted/30'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: m.groupColor }}
                          />
                          <span className="font-medium">
                            {m.subject.label || `${m.groupName}-${m.subject.subjectNumber}`}
                          </span>
                          {hasData ? (
                            <Badge variant="outline" className="text-green-600">
                              Data recorded
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              No data
                            </Badge>
                          )}
                        </div>
                        {hasData && (
                          <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-2">
                            {m.data.heightCm && <span>Height: {m.data.heightCm}cm</span>}
                            {m.data.leafCount && <span>Leaves: {m.data.leafCount}</span>}
                            {m.data.vigorScore && <span>Vigor: {m.data.vigorScore}/5</span>}
                            {m.data.ec && <span>EC: {m.data.ec}</span>}
                            {m.data.ph && <span>pH: {m.data.ph}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div>
                  <Label className="text-sm">Additional Notes</Label>
                  <Textarea
                    placeholder="Any observations or anomalies..."
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
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
            <Button type="button" onClick={handleNext} disabled={selectedSubjectIds.size === 0}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Measurements
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
