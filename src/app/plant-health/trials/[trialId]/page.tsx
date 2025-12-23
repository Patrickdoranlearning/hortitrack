'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { toast } from 'sonner';
import {
  ChevronLeft,
  Play,
  Pause,
  CheckCircle2,
  Archive,
  MoreHorizontal,
  Trash2,
  Pencil,
  FlaskConical,
  Calendar,
  Users,
  BarChart3,
  ClipboardList,
  Lightbulb,
  Loader2,
  Plus,
  Ruler,
} from 'lucide-react';
import { getTrial, updateTrialStatus, deleteTrial, getMeasurementsForTrial } from '@/app/actions/trials';
import type { TrialWithRelations, TrialStatus, TrialGroupWithSubjects, TrialMeasurement } from '@/types/trial';
import { GROUP_COLORS, SCORE_LABELS } from '@/types/trial';

const STATUS_CONFIG: Record<TrialStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
  draft: { label: 'Draft', variant: 'secondary', color: 'text-gray-500' },
  active: { label: 'Active', variant: 'default', color: 'text-green-600' },
  paused: { label: 'Paused', variant: 'outline', color: 'text-yellow-600' },
  completed: { label: 'Completed', variant: 'default', color: 'text-blue-600' },
  archived: { label: 'Archived', variant: 'secondary', color: 'text-gray-400' },
};

export default function TrialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const trialId = params.trialId as string;

  const [trial, setTrial] = useState<TrialWithRelations | null>(null);
  const [measurements, setMeasurements] = useState<TrialMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchTrial = useCallback(async () => {
    setLoading(true);
    const [trialResult, measurementsResult] = await Promise.all([
      getTrial(trialId),
      getMeasurementsForTrial(trialId),
    ]);

    if (trialResult.success && trialResult.data) {
      setTrial(trialResult.data);
    } else {
      toast.error('Failed to load trial');
    }

    if (measurementsResult.success && measurementsResult.data) {
      setMeasurements(measurementsResult.data);
    }

    setLoading(false);
  }, [trialId]);

  useEffect(() => {
    fetchTrial();
  }, [fetchTrial]);

  const handleStatusChange = async (newStatus: TrialStatus) => {
    if (!trial) return;
    setIsUpdating(true);

    const result = await updateTrialStatus(trial.id!, newStatus);
    if (result.success) {
      toast.success(`Trial ${newStatus === 'active' ? 'started' : newStatus}`);
      fetchTrial();
    } else {
      toast.error(result.error || 'Failed to update status');
    }
    setIsUpdating(false);
  };

  const handleDelete = async () => {
    if (!trial) return;

    const result = await deleteTrial(trial.id!);
    if (result.success) {
      toast.success('Trial deleted');
      router.push('/plant-health/trials');
    } else {
      toast.error(result.error || 'Failed to delete trial');
    }
    setDeleteDialogOpen(false);
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
          <Link href="/plant-health/trials">
            <Button variant="outline" className="mt-4">
              Back to Trials
            </Button>
          </Link>
        </div>
      </PageFrame>
    );
  }

  const statusConfig = STATUS_CONFIG[trial.status];
  const currentWeek = trial.startDate
    ? Math.floor((Date.now() - new Date(trial.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0;
  const totalSubjects = trial.groups?.reduce((sum, g) => sum + (g.subjects?.length || 0), 0) || 0;

  return (
    <PageFrame moduleKey="plantHealth">
      <div className="space-y-6">
        <ModulePageHeader
          title={
            <span className="flex items-center gap-3">
              <span>{trial.name}</span>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </span>
          }
          description={
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="font-mono">{trial.trialNumber}</span>
              {trial.variety && (
                <>
                  <span>•</span>
                  <span>{trial.variety.name}</span>
                </>
              )}
              {trial.status === 'active' && (
                <>
                  <span>•</span>
                  <span>Week {currentWeek}</span>
                </>
              )}
            </span>
          }
          actionsSlot={
            <div className="flex items-center gap-2">
              <Link href="/plant-health/trials">
                <Button variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>

              {trial.status === 'active' && (
                <Link href={`/plant-health/trials/${trial.id}/record`}>
                  <Button size="sm" className="gap-2">
                    <Ruler className="h-4 w-4" />
                    Quick Record
                  </Button>
                </Link>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={isUpdating}>
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {trial.status === 'draft' && (
                    <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                      <Play className="mr-2 h-4 w-4" />
                      Start Trial
                    </DropdownMenuItem>
                  )}
                  {trial.status === 'active' && (
                    <DropdownMenuItem onClick={() => handleStatusChange('paused')}>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause Trial
                    </DropdownMenuItem>
                  )}
                  {trial.status === 'paused' && (
                    <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                      <Play className="mr-2 h-4 w-4" />
                      Resume Trial
                    </DropdownMenuItem>
                  )}
                  {(trial.status === 'active' || trial.status === 'paused') && (
                    <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete Trial
                    </DropdownMenuItem>
                  )}
                  {trial.status === 'completed' && (
                    <DropdownMenuItem onClick={() => handleStatusChange('archived')}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive Trial
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Trial
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        {/* Draft Trial - Prominent Start Button */}
        {trial.status === 'draft' && (
          <Card className="border-2 border-dashed border-green-300 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="font-semibold text-lg">Ready to start your trial?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {trial.groups?.length || 0} groups with {totalSubjects} subjects configured
                </p>
              </div>
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto"
                onClick={() => handleStatusChange('active')}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
                Start Trial Now
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{trial.groups?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <FlaskConical className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{totalSubjects}</p>
                  <p className="text-xs text-muted-foreground">Subjects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{measurements.length}</p>
                  <p className="text-xs text-muted-foreground">Measurements</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {trial.status === 'active' ? `W${currentWeek}` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">Current Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="measurements">Measurements</TabsTrigger>
            <TabsTrigger value="findings">Findings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Trial Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Trial Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {trial.hypothesis && (
                    <div>
                      <p className="font-medium text-muted-foreground">Hypothesis</p>
                      <p>{trial.hypothesis}</p>
                    </div>
                  )}
                  {trial.objective && (
                    <div>
                      <p className="font-medium text-muted-foreground">Objective</p>
                      <p>{trial.objective}</p>
                    </div>
                  )}
                  {trial.description && (
                    <div>
                      <p className="font-medium text-muted-foreground">Description</p>
                      <p>{trial.description}</p>
                    </div>
                  )}
                  {!trial.hypothesis && !trial.objective && !trial.description && (
                    <p className="text-muted-foreground">No additional information provided.</p>
                  )}
                </CardContent>
              </Card>

              {/* Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-muted-foreground">Start Date</p>
                      <p>
                        {trial.startDate
                          ? new Date(trial.startDate).toLocaleDateString('en-IE')
                          : 'Not started'}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Planned End</p>
                      <p>
                        {trial.plannedEndDate
                          ? new Date(trial.plannedEndDate).toLocaleDateString('en-IE')
                          : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Measurement Frequency</p>
                      <p>Every {trial.measurementFrequencyDays} days</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Location</p>
                      <p>{trial.location?.name || 'Not specified'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Groups Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Groups</CardTitle>
                  <Link href={`/plant-health/trials/${trial.id}/record`}>
                    <Button variant="outline" size="sm" disabled={trial.status !== 'active'}>
                      <Ruler className="h-4 w-4 mr-1" />
                      Quick Record
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {trial.groups?.map((group) => (
                    <GroupCard key={group.id} group={group} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Trial Groups</CardTitle>
                <CardDescription>
                  View and manage trial groups and their subjects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {trial.groups?.map((group) => (
                  <GroupDetailCard key={group.id} group={group} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="measurements" className="mt-4">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Measurements</h3>
                  <p className="text-sm text-muted-foreground">
                    Compare treatment groups side by side
                  </p>
                </div>
                <Link href={`/plant-health/trials/${trial.id}/record`}>
                  <Button disabled={trial.status !== 'active'}>
                    <Plus className="h-4 w-4 mr-1" />
                    Quick Record
                  </Button>
                </Link>
              </div>

              {measurements.length > 0 ? (
                <>
                  {/* Side-by-side group comparison cards */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {trial.groups?.map((group) => {
                      // Get measurements for this group's subjects
                      const subjectIds = group.subjects?.map(s => s.id) || [];
                      const groupMeasurements = measurements.filter(m =>
                        subjectIds.includes(m.subjectId)
                      );

                      // Calculate averages for the latest measurements
                      const latestDate = groupMeasurements.length > 0
                        ? groupMeasurements.reduce((max, m) =>
                            m.measurementDate > max ? m.measurementDate : max,
                            groupMeasurements[0].measurementDate
                          )
                        : null;

                      const latestMeasurements = latestDate
                        ? groupMeasurements.filter(m => m.measurementDate === latestDate)
                        : [];

                      const avgHeight = latestMeasurements.length > 0
                        ? latestMeasurements.reduce((sum, m) => sum + (m.heightCm || 0), 0) / latestMeasurements.filter(m => m.heightCm).length
                        : null;
                      const avgVigor = latestMeasurements.length > 0
                        ? latestMeasurements.reduce((sum, m) => sum + (m.vigorScore || 0), 0) / latestMeasurements.filter(m => m.vigorScore).length
                        : null;
                      const avgHealth = latestMeasurements.length > 0
                        ? latestMeasurements.reduce((sum, m) => sum + (m.overallHealthScore || 0), 0) / latestMeasurements.filter(m => m.overallHealthScore).length
                        : null;
                      const avgEc = latestMeasurements.length > 0
                        ? latestMeasurements.reduce((sum, m) => sum + (m.ec || 0), 0) / latestMeasurements.filter(m => m.ec).length
                        : null;
                      const avgPh = latestMeasurements.length > 0
                        ? latestMeasurements.reduce((sum, m) => sum + (m.ph || 0), 0) / latestMeasurements.filter(m => m.ph).length
                        : null;

                      return (
                        <Card
                          key={group.id}
                          className={group.groupType === 'control' ? 'border-gray-300' : ''}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: group.labelColor || '#6B7280' }}
                              />
                              <CardTitle className="text-base">{group.name}</CardTitle>
                              <Badge
                                variant={group.groupType === 'control' ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {group.groupType === 'control' ? 'Control' : 'Treatment'}
                              </Badge>
                            </div>
                            <CardDescription className="text-xs">
                              {groupMeasurements.length} measurements • {group.subjects?.length || 0} subjects
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {latestMeasurements.length > 0 ? (
                              <div className="space-y-3">
                                {/* Latest date indicator */}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    Latest: {new Date(latestDate!).toLocaleDateString('en-IE', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </span>
                                </div>

                                {/* Averages grid */}
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {avgHeight && !isNaN(avgHeight) && (
                                    <div className="p-2 bg-muted/50 rounded">
                                      <p className="text-xs text-muted-foreground">Avg Stem</p>
                                      <p className="font-semibold">{avgHeight.toFixed(1)} cm</p>
                                    </div>
                                  )}
                                  {avgVigor && !isNaN(avgVigor) && (
                                    <div className="p-2 bg-muted/50 rounded">
                                      <p className="text-xs text-muted-foreground">Avg Vigor</p>
                                      <p className="font-semibold">{avgVigor.toFixed(1)}/5</p>
                                    </div>
                                  )}
                                  {avgHealth && !isNaN(avgHealth) && (
                                    <div className="p-2 bg-muted/50 rounded">
                                      <p className="text-xs text-muted-foreground">Avg Health</p>
                                      <p className="font-semibold">{avgHealth.toFixed(1)}/5</p>
                                    </div>
                                  )}
                                  {avgEc && !isNaN(avgEc) && (
                                    <div className="p-2 bg-muted/50 rounded">
                                      <p className="text-xs text-muted-foreground">Avg EC</p>
                                      <p className="font-semibold">{avgEc.toFixed(2)}</p>
                                    </div>
                                  )}
                                  {avgPh && !isNaN(avgPh) && (
                                    <div className="p-2 bg-muted/50 rounded">
                                      <p className="text-xs text-muted-foreground">Avg pH</p>
                                      <p className="font-semibold">{avgPh.toFixed(1)}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Recent observations */}
                                {latestMeasurements.some(m => m.observations) && (
                                  <div className="text-xs">
                                    <p className="text-muted-foreground mb-1">Notes:</p>
                                    {latestMeasurements
                                      .filter(m => m.observations)
                                      .slice(0, 2)
                                      .map(m => (
                                        <p key={m.id} className="italic text-muted-foreground line-clamp-1">
                                          "{m.observations}"
                                        </p>
                                      ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground py-4 text-center">
                                No measurements yet
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Detailed measurements by date */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Measurement History</CardTitle>
                      <CardDescription>
                        All recorded measurements grouped by date
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Object.entries(
                          measurements.reduce((acc, m) => {
                            const date = m.measurementDate;
                            if (!acc[date]) acc[date] = [];
                            acc[date].push(m);
                            return acc;
                          }, {} as Record<string, TrialMeasurement[]>)
                        )
                          .sort(([a], [b]) => b.localeCompare(a))
                          .map(([date, dateMeasurements]) => (
                            <div key={date} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium">
                                  {new Date(date).toLocaleDateString('en-IE', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </h4>
                                <Badge variant="outline">
                                  Week {dateMeasurements[0]?.weekNumber ?? 0}
                                </Badge>
                              </div>

                              {/* Group measurements by treatment group for side-by-side comparison */}
                              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {trial.groups?.map((group) => {
                                  const subjectIds = group.subjects?.map(s => s.id) || [];
                                  const groupDateMeasurements = dateMeasurements.filter(m =>
                                    subjectIds.includes(m.subjectId)
                                  );

                                  if (groupDateMeasurements.length === 0) return null;

                                  return (
                                    <div
                                      key={group.id}
                                      className="p-3 rounded-lg border"
                                      style={{ borderLeftColor: group.labelColor || '#6B7280', borderLeftWidth: '3px' }}
                                    >
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="font-medium text-sm">{group.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {groupDateMeasurements.length} readings
                                        </Badge>
                                      </div>

                                      {/* Summary stats for this group on this date */}
                                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                        {groupDateMeasurements.some(m => m.heightCm) && (
                                          <span>
                                            Stem: {(groupDateMeasurements.reduce((s, m) => s + (m.heightCm || 0), 0) / groupDateMeasurements.filter(m => m.heightCm).length).toFixed(1)}cm
                                          </span>
                                        )}
                                        {groupDateMeasurements.some(m => m.ec) && (
                                          <span>
                                            EC: {(groupDateMeasurements.reduce((s, m) => s + (m.ec || 0), 0) / groupDateMeasurements.filter(m => m.ec).length).toFixed(2)}
                                          </span>
                                        )}
                                        {groupDateMeasurements.some(m => m.ph) && (
                                          <span>
                                            pH: {(groupDateMeasurements.reduce((s, m) => s + (m.ph || 0), 0) / groupDateMeasurements.filter(m => m.ph).length).toFixed(1)}
                                          </span>
                                        )}
                                        {groupDateMeasurements.some(m => m.vigorScore) && (
                                          <span>
                                            Vigor: {(groupDateMeasurements.reduce((s, m) => s + (m.vigorScore || 0), 0) / groupDateMeasurements.filter(m => m.vigorScore).length).toFixed(1)}/5
                                          </span>
                                        )}
                                        {groupDateMeasurements.some(m => m.overallHealthScore) && (
                                          <span>
                                            Health: {(groupDateMeasurements.reduce((s, m) => s + (m.overallHealthScore || 0), 0) / groupDateMeasurements.filter(m => m.overallHealthScore).length).toFixed(1)}/5
                                          </span>
                                        )}
                                      </div>

                                      {/* Show observations */}
                                      {groupDateMeasurements.filter(m => m.observations).length > 0 && (
                                        <div className="mt-2 pt-2 border-t">
                                          {groupDateMeasurements
                                            .filter(m => m.observations)
                                            .map(m => (
                                              <p key={m.id} className="text-xs italic text-muted-foreground line-clamp-2">
                                                {m.observations}
                                              </p>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/50" />
                      <p className="mt-4 text-muted-foreground">
                        No measurements recorded yet
                      </p>
                      {trial.status === 'active' && (
                        <Link href={`/plant-health/trials/${trial.id}/record`}>
                          <Button variant="outline" className="mt-4">
                            Record First Measurement
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="findings" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Findings</CardTitle>
                    <CardDescription>
                      Document observations, conclusions, and recommendations
                    </CardDescription>
                  </div>
                  <Link href={`/plant-health/trials/${trial.id}/findings`}>
                    <Button>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Finding
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {trial.findings && trial.findings.length > 0 ? (
                  <div className="space-y-3">
                    {trial.findings.map((finding) => (
                      <Card key={finding.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge variant="outline" className="mb-2">
                              {finding.findingType}
                            </Badge>
                            <h4 className="font-medium">{finding.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {finding.description}
                            </p>
                          </div>
                          <Badge>{finding.status}</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Lightbulb className="h-16 w-16 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No findings documented yet</p>
                    <Link href={`/plant-health/trials/${trial.id}/findings`}>
                      <Button variant="outline" className="mt-4">
                        Document First Finding
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Trial</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{trial.name}"? This will permanently delete all
                groups, subjects, measurements, and findings. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageFrame>
  );
}

function GroupCard({ group }: { group: TrialGroupWithSubjects }) {
  const isControl = group.groupType === 'control';

  return (
    <Card className={isControl ? 'border-gray-300' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: group.labelColor || '#6B7280' }}
          />
          <span className="font-medium">{group.name}</span>
          <Badge variant={isControl ? 'secondary' : 'outline'} className="text-xs">
            {isControl ? 'Control' : 'Treatment'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {group.description || 'No description'}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{group.subjects?.length || 0} subjects</span>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupDetailCard({ group }: { group: TrialGroupWithSubjects }) {
  const isControl = group.groupType === 'control';

  return (
    <Card className={isControl ? 'bg-gray-50 dark:bg-gray-900/50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: group.labelColor || '#6B7280' }}
            />
            <span className="font-semibold">{group.name}</span>
            <Badge variant={isControl ? 'secondary' : 'default'}>
              {isControl ? 'Control' : 'Treatment'}
            </Badge>
          </div>
        </div>

        {group.description && (
          <p className="text-sm text-muted-foreground mb-3">{group.description}</p>
        )}

        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Subjects ({group.subjects?.length || 0})
          </p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {group.subjects?.map((subject) => (
              <div
                key={subject.id}
                className={`
                  flex items-center justify-center h-10 rounded border text-xs
                  ${subject.isActive ? 'bg-muted/30' : 'bg-red-50 dark:bg-red-950/30 line-through'}
                `}
              >
                {subject.label || `${group.name}-${subject.subjectNumber}`}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
