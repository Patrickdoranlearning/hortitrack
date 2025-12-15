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
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
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
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Measurements</CardTitle>
                    <CardDescription>
                      Weekly measurement data for all subjects
                    </CardDescription>
                  </div>
                  <Link href={`/plant-health/trials/${trial.id}/record`}>
                    <Button disabled={trial.status !== 'active'}>
                      <Plus className="h-4 w-4 mr-1" />
                      Quick Record
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {measurements.length > 0 ? (
                  <div className="space-y-4">
                    {/* Group measurements by date */}
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
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {dateMeasurements.map((m) => {
                              const subject = trial.groups
                                ?.flatMap((g) => g.subjects || [])
                                .find((s) => s.id === m.subjectId);
                              const group = trial.groups?.find((g) =>
                                g.subjects?.some((s) => s.id === m.subjectId)
                              );
                              return (
                                <div
                                  key={m.id}
                                  className="p-3 bg-muted/50 rounded-lg text-sm"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{
                                        backgroundColor:
                                          group?.labelColor || '#6B7280',
                                      }}
                                    />
                                    <span className="font-medium">
                                      {subject?.label || 'Unknown'}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                    {m.heightCm && (
                                      <span>Stem: {m.heightCm}cm</span>
                                    )}
                                    {m.ec && <span>EC: {m.ec}</span>}
                                    {m.ph && <span>pH: {m.ph}</span>}
                                    {m.vigorScore && (
                                      <span>Vigor: {m.vigorScore}/5</span>
                                    )}
                                    {m.overallHealthScore && (
                                      <span>Health: {m.overallHealthScore}/5</span>
                                    )}
                                  </div>
                                  {m.observations && (
                                    <p className="mt-2 text-xs italic text-muted-foreground">
                                      {m.observations}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
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
                )}
              </CardContent>
            </Card>
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
