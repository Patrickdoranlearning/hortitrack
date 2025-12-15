'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import {
  FlaskConical,
  Repeat,
  ScanLine,
  Calendar,
  MapPin,
  Package,
  ShieldAlert,
  Clock,
  Syringe,
  Leaf,
  ChevronRight,
  Plus,
  RefreshCw,
  Loader2,
  ListTodo,
  Beaker,
  Microscope,
} from 'lucide-react';
import {
  listIpmPrograms,
  listIpmAssignments,
  getUpcomingTreatments,
  listLocations,
  type IpmProgram,
  type IpmAssignment,
  type IpmSpotTreatment,
  type LocationBasic,
} from '@/app/actions/ipm';
import { bulkGenerateTasks, getGroupedTasks, type TaskGroup } from '@/app/actions/ipm-tasks';
import { toast } from 'sonner';

export default function PlantHealthDashboard() {
  const [programs, setPrograms] = useState<IpmProgram[]>([]);
  const [assignments, setAssignments] = useState<IpmAssignment[]>([]);
  const [upcomingTreatments, setUpcomingTreatments] = useState<IpmSpotTreatment[]>([]);
  const [restrictedLocations, setRestrictedLocations] = useState<LocationBasic[]>([]);
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [programsResult, assignmentsResult, treatmentsResult, locationsResult, tasksResult] = await Promise.all([
      listIpmPrograms(),
      listIpmAssignments({ activeOnly: true }),
      getUpcomingTreatments(14), // Next 2 weeks
      listLocations(),
      getGroupedTasks({ status: 'pending' }),
    ]);

    if (programsResult.success && programsResult.data) {
      setPrograms(programsResult.data.filter((p) => p.isActive));
    }
    if (assignmentsResult.success && assignmentsResult.data) {
      setAssignments(assignmentsResult.data);
    }
    if (treatmentsResult.success && treatmentsResult.data) {
      setUpcomingTreatments(treatmentsResult.data);
    }
    if (locationsResult.success && locationsResult.data) {
      const restricted = locationsResult.data.filter(
        (l) => l.healthStatus === 'restricted' && l.restrictedUntil
      );
      setRestrictedLocations(restricted);
    }
    if (tasksResult.success && tasksResult.data) {
      setTaskGroups(tasksResult.data.slice(0, 5)); // Show top 5 task groups
    }
    setLoading(false);
  }, []);

  const handleGenerateTasks = async () => {
    setGenerating(true);
    const result = await bulkGenerateTasks({ clearExisting: false });
    if (result.success && result.data) {
      toast.success(`Generated ${result.data.tasksCreated} tasks for ${result.data.batchesProcessed} batches`);
      fetchData();
    } else {
      toast.error(result.error || 'Failed to generate tasks');
    }
    setGenerating(false);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTimeRemaining = (until: string) => {
    const diff = new Date(until).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <PageFrame moduleKey="plantHealth">
      <div className="space-y-6">
        <ModulePageHeader
          title="Plant Health"
          description="IPM programs, scouting, and treatments"
          actionsSlot={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleGenerateTasks}
                disabled={generating}
                className="gap-2"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Generate Tasks
              </Button>
              <Link href="/plant-health/tasks">
                <Button variant="outline" className="gap-2">
                  <ListTodo className="h-4 w-4" />
                  Tasks
                </Button>
              </Link>
              <Link href="/plant-health/scout">
                <Button className="gap-2">
                  <ScanLine className="h-4 w-4" />
                  Scout
                </Button>
              </Link>
            </div>
          }
        />

        {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Link href="/plant-health/products">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <FlaskConical className="h-8 w-8 text-blue-600" />
              <div>
                <p className="font-medium">IPM Products</p>
                <p className="text-xs text-muted-foreground">Manage database</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/plant-health/programs">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Repeat className="h-8 w-8 text-purple-600" />
              <div>
                <p className="font-medium">IPM Programs</p>
                <p className="text-xs text-muted-foreground">{programs.length} active</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/plant-health/trials">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Microscope className="h-8 w-8 text-teal-600" />
              <div>
                <p className="font-medium">Trials</p>
                <p className="text-xs text-muted-foreground">Scientific tests</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/plant-health/scout">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <ScanLine className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium">Scout Mode</p>
                <p className="text-xs text-muted-foreground">Scan & log</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/locations">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <MapPin className="h-8 w-8 text-amber-600" />
              <div>
                <p className="font-medium">Locations</p>
                <p className="text-xs text-muted-foreground">View all</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Restricted Locations Alert */}
          {restrictedLocations.length > 0 && (
            <Card className="lg:col-span-2 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                  <ShieldAlert className="h-5 w-5" />
                  Restricted Locations ({restrictedLocations.length})
                </CardTitle>
                <CardDescription className="text-orange-700 dark:text-orange-300">
                  These locations have active re-entry restrictions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {restrictedLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between bg-background/80 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-orange-600" />
                        <span className="font-medium">{loc.name}</span>
                      </div>
                      <Badge variant="destructive" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {getTimeRemaining(loc.restrictedUntil!)} remaining
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* IPM Tasks */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ListTodo className="h-5 w-5" />
                    IPM Tasks
                  </CardTitle>
                  <CardDescription>Spray schedules grouped by product and week</CardDescription>
                </div>
                <Link href="/plant-health/tasks">
                  <Button variant="ghost" size="sm">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {taskGroups.length === 0 ? (
                <div className="text-center py-8">
                  <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No pending tasks</p>
                  <p className="text-sm text-muted-foreground">
                    Click &quot;Generate Tasks&quot; to create tasks from IPM programs
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {taskGroups.map((group, idx) => (
                    <Link key={idx} href="/plant-health/tasks">
                      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {group.isTankMix ? (
                              <Beaker className="h-4 w-4 text-purple-600" />
                            ) : (
                              <FlaskConical className="h-4 w-4 text-primary" />
                            )}
                            <span className="font-medium text-sm truncate">
                              {group.isTankMix
                                ? group.tankMixProducts?.join(' + ')
                                : group.productName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Week {group.calendarWeek}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {group.totalBatches} batch{group.totalBatches !== 1 ? 'es' : ''}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {group.locations.slice(0, 2).map((loc) => (
                              <Badge key={loc.id} variant="outline" className="text-xs">
                                {loc.name}
                              </Badge>
                            ))}
                            {group.locations.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{group.locations.length - 2}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Treatments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Spot Treatments
              </CardTitle>
              <CardDescription>Scheduled one-off treatments</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingTreatments.length === 0 ? (
                <div className="text-center py-8">
                  <Syringe className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No upcoming treatments</p>
                  <p className="text-sm text-muted-foreground">
                    Schedule spot treatments from the Scout page
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingTreatments.slice(0, 5).map((treatment) => (
                    <div
                      key={treatment.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <Syringe className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{treatment.product?.name || 'Treatment'}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {treatment.targetType === 'location' ? (
                              <>
                                <MapPin className="h-3 w-3" />
                                {treatment.location?.name}
                              </>
                            ) : (
                              <>
                                <Package className="h-3 w-3" />
                                {treatment.batch?.batchNumber}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">
                          {formatDate(treatment.nextApplicationDate!)}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {treatment.applicationsCompleted + 1} of {treatment.applicationsTotal}
                        </p>
                      </div>
                    </div>
                  ))}
                  {upcomingTreatments.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      +{upcomingTreatments.length - 5} more scheduled
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Programs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Repeat className="h-5 w-5" />
                    Active Programs
                  </CardTitle>
                  <CardDescription>Interval-based IPM programs</CardDescription>
                </div>
                <Link href="/plant-health/programs">
                  <Button variant="ghost" size="sm">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {programs.length === 0 ? (
                <div className="text-center py-8">
                  <Repeat className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No active programs</p>
                  <Link href="/plant-health/programs">
                    <Button variant="outline" className="mt-4">
                      <Plus className="h-4 w-4 mr-1" />
                      Create Program
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {programs.slice(0, 4).map((program) => {
                    const programAssignments = assignments.filter(
                      (a) => a.programId === program.id && a.isActive
                    );
                    return (
                      <div
                        key={program.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{program.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              Every {program.intervalDays}d
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {program.durationWeeks}w
                            </Badge>
                            {program.steps && (
                              <Badge variant="secondary" className="text-xs">
                                {program.steps.length} product{program.steps.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{programAssignments.length}</p>
                          <p className="text-xs text-muted-foreground">assignments</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </PageFrame>
  );
}

