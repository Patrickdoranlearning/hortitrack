'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { PageFrame } from '@/ui/templates';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Camera,
  Check,
  Leaf,
  ThermometerSun,
  Droplets,
  Activity,
} from 'lucide-react';
import { getTrial, createBulkMeasurements } from '@/app/actions/trials';
import { TrialCamera } from '@/components/trials/TrialCamera';
import type { TrialWithRelations, MeasurementInput } from '@/types/trial';
import { SCORE_LABELS } from '@/types/trial';

type GroupMeasurement = {
  heightCm?: number;
  leafCount?: number;
  ec?: number;
  ph?: number;
  vigorScore?: number;
  overallHealthScore?: number;
  observations?: string;
  photoUrl?: string;
};

export default function QuickRecordPage() {
  const params = useParams();
  const router = useRouter();
  const trialId = params.trialId as string;

  const [trial, setTrial] = useState<TrialWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupMeasurements, setGroupMeasurements] = useState<Map<string, GroupMeasurement>>(new Map());
  const [capturedPhotos, setCapturedPhotos] = useState<Map<string, string>>(new Map());
  const [showCamera, setShowCamera] = useState(false);

  const fetchTrial = useCallback(async () => {
    setLoading(true);
    const result = await getTrial(trialId);
    if (result.success && result.data) {
      setTrial(result.data);
      // Initialize measurements for each group
      const initial = new Map<string, GroupMeasurement>();
      result.data.groups?.forEach((g) => {
        initial.set(g.id!, { vigorScore: 3, overallHealthScore: 3 });
      });
      setGroupMeasurements(initial);
    } else {
      toast.error('Failed to load trial');
    }
    setLoading(false);
  }, [trialId]);

  useEffect(() => {
    fetchTrial();
  }, [fetchTrial]);

  const currentGroup = trial?.groups?.[currentGroupIndex];
  const totalGroups = trial?.groups?.length || 0;
  const isLastGroup = currentGroupIndex >= totalGroups - 1;

  const currentWeek = trial?.startDate
    ? Math.floor((Date.now() - new Date(trial.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0;

  const updateGroupMeasurement = (field: keyof GroupMeasurement, value: any) => {
    if (!currentGroup?.id) return;
    const current = groupMeasurements.get(currentGroup.id) || {};
    setGroupMeasurements(new Map(groupMeasurements.set(currentGroup.id, { ...current, [field]: value })));
  };

  const handlePhotoCapture = (imageDataUrl: string) => {
    if (currentGroup?.id) {
      setCapturedPhotos(new Map(capturedPhotos.set(currentGroup.id, imageDataUrl)));
    }
    setShowCamera(false);
  };

  const handleNext = () => {
    if (currentGroupIndex < totalGroups - 1) {
      setCurrentGroupIndex(currentGroupIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentGroupIndex > 0) {
      setCurrentGroupIndex(currentGroupIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!trial) return;
    setIsSubmitting(true);

    try {
      const measurementsToCreate: MeasurementInput[] = [];
      const measurementDate = new Date().toISOString().split('T')[0];

      // For each group, create measurements for all active subjects
      for (const group of trial.groups || []) {
        const groupData = groupMeasurements.get(group.id!) || {};

        for (const subject of group.subjects || []) {
          if (!subject.isActive) continue;

          measurementsToCreate.push({
            subjectId: subject.id!,
            measurementDate,
            weekNumber: currentWeek,
            heightCm: groupData.heightCm,
            leafCount: groupData.leafCount,
            ec: groupData.ec,
            ph: groupData.ph,
            vigorScore: groupData.vigorScore,
            overallHealthScore: groupData.overallHealthScore,
            observations: groupData.observations,
          });
        }
      }

      if (measurementsToCreate.length === 0) {
        toast.error('No measurements to record');
        setIsSubmitting(false);
        return;
      }

      console.log('[QuickRecord] Saving measurements:', measurementsToCreate);
      const result = await createBulkMeasurements(measurementsToCreate);
      console.log('[QuickRecord] Result:', result);

      if (result.success) {
        toast.success(`Recorded measurements for ${trial.groups?.length} groups`);
        router.push(`/plant-health/trials/${trialId}`);
      } else {
        console.error('[QuickRecord] Failed:', result.error);
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

  if (!trial || !currentGroup) {
    return (
      <PageFrame moduleKey="plantHealth">
        <div className="text-center py-20">
          <p className="text-muted-foreground">Trial not found</p>
          <Link href="/plant-health/trials">
            <Button variant="outline" className="mt-4">Back to Trials</Button>
          </Link>
        </div>
      </PageFrame>
    );
  }

  const groupData = groupMeasurements.get(currentGroup.id!) || {};
  const groupPhoto = capturedPhotos.get(currentGroup.id!);

  // Show camera overlay
  if (showCamera && currentGroup) {
    return (
      <TrialCamera
        groupName={currentGroup.name}
        groupColor={currentGroup.labelColor || '#6B7280'}
        onCapture={handlePhotoCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <PageFrame moduleKey="plantHealth">
      <div className="max-w-lg mx-auto space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href={`/plant-health/trials/${trialId}`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <Badge variant="outline">Week {currentWeek}</Badge>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          {trial.groups?.map((g, idx) => (
            <div
              key={g.id}
              className={`flex-1 h-2 rounded-full transition-colors ${
                idx < currentGroupIndex
                  ? 'bg-green-500'
                  : idx === currentGroupIndex
                  ? 'bg-primary'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Group Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: currentGroup.labelColor || '#6B7280' }}
              />
              <div>
                <CardTitle className="text-lg">{currentGroup.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {currentGroup.groupType === 'control' ? 'Control Group' : 'Treatment Group'} •{' '}
                  {currentGroup.subjects?.filter((s) => s.isActive).length} plants
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Photo Section */}
        <Card>
          <CardContent className="p-4">
            {groupPhoto ? (
              <div className="relative">
                <img
                  src={groupPhoto}
                  alt={`${currentGroup.name} photo`}
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 right-2"
                  onClick={() => setShowCamera(true)}
                >
                  <Camera className="h-4 w-4 mr-1" />
                  Retake
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowCamera(true)}
                className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm font-medium">Take Standardized Photo</span>
                <span className="text-xs">Use guide overlay for consistent framing</span>
              </button>
            )}
          </CardContent>
        </Card>

        {/* Quick Measurements */}
        <Card>
          <CardContent className="p-4 space-y-5">
            {/* Photo-based measurement note */}
            {groupPhoto && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm">
                <Check className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-green-800 dark:text-green-200">
                  Photo captured for height analysis
                </span>
              </div>
            )}

            {/* Stem Length */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Leaf className="h-4 w-4" />
                Stem Length (cm)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="e.g. 12.5"
                value={groupData.heightCm || ''}
                onChange={(e) => updateGroupMeasurement('heightCm', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="text-lg h-12"
              />
            </div>

            {/* EC and pH row */}
            <div className="grid grid-cols-2 gap-4">
              {/* EC */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  EC (mS/cm)
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="e.g. 1.8"
                  value={groupData.ec || ''}
                  onChange={(e) => updateGroupMeasurement('ec', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="text-lg h-12"
                />
              </div>

              {/* pH */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Droplets className="h-4 w-4" />
                  pH
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="e.g. 6.2"
                  value={groupData.ph || ''}
                  onChange={(e) => updateGroupMeasurement('ph', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="text-lg h-12"
                />
              </div>
            </div>

            {/* Vigor Score */}
            <div className="space-y-3">
              <Label className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ThermometerSun className="h-4 w-4" />
                  Vigor Score
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {groupData.vigorScore} - {SCORE_LABELS[groupData.vigorScore as keyof typeof SCORE_LABELS] || 'Average'}
                </span>
              </Label>
              <Slider
                value={[groupData.vigorScore || 3]}
                onValueChange={([v]) => updateGroupMeasurement('vigorScore', v)}
                min={1}
                max={5}
                step={1}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Poor</span>
                <span>Excellent</span>
              </div>
            </div>

            {/* Overall Health */}
            <div className="space-y-3">
              <Label className="flex items-center justify-between">
                <span>Overall Health</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {groupData.overallHealthScore} - {SCORE_LABELS[groupData.overallHealthScore as keyof typeof SCORE_LABELS] || 'Average'}
                </span>
              </Label>
              <Slider
                value={[groupData.overallHealthScore || 3]}
                onValueChange={([v]) => updateGroupMeasurement('overallHealthScore', v)}
                min={1}
                max={5}
                step={1}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Poor</span>
                <span>Excellent</span>
              </div>
            </div>

            {/* Observations */}
            <div className="space-y-2">
              <Label>Observations (optional)</Label>
              <Textarea
                placeholder="Any notes about this group..."
                value={groupData.observations || ''}
                onChange={(e) => updateGroupMeasurement('observations', e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Navigation - Fixed at bottom on mobile */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex gap-3">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentGroupIndex === 0}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          {isLastGroup ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Save All
            </Button>
          ) : (
            <Button onClick={handleNext} className="flex-1">
              Next Group
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
