'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  UserCheck,
  Play,
  CheckCircle2,
  MapPin,
  Leaf,
  Beaker,
  FlaskConical,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import type { IpmJob, JobsByStatus } from '@/types/ipm-jobs';
import type { TaskGroup } from '@/app/actions/ipm-tasks';
import { createJob, assignJob } from '@/app/actions/ipm-tasks';
import { CreateJobSheet } from './CreateJobSheet';
import { AssignJobSheet } from './AssignJobSheet';
import { cn } from '@/lib/utils';

type Props = {
  jobsByStatus: JobsByStatus;
  taskGroups: TaskGroup[];
  calendarWeek: number;
  onWeekChange: (week: number) => void;
  onRefresh: () => void;
};

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

function JobCard({
  job,
  onAssign,
  onView,
}: {
  job: IpmJob;
  onAssign?: () => void;
  onView?: () => void;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        job.priority === 'urgent' && 'border-red-300 bg-red-50/50',
        job.priority === 'high' && 'border-amber-300 bg-amber-50/50'
      )}
      onClick={onView}
    >
      <CardHeader className="py-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {job.product.isTankMix ? (
              <Beaker className="h-4 w-4 text-purple-600 shrink-0" />
            ) : (
              <FlaskConical className="h-4 w-4 text-primary shrink-0" />
            )}
            <CardTitle className="text-sm font-medium truncate">{job.name}</CardTitle>
          </div>
          {job.priority !== 'normal' && (
            <Badge variant="secondary" className={cn('text-xs shrink-0', PRIORITY_COLORS[job.priority])}>
              {job.priority}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {job.locationCount}
          </span>
          <span className="flex items-center gap-1">
            <Leaf className="h-3 w-3" />
            {job.batchCount}
          </span>
        </div>
        {job.assignedToName && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            <UserCheck className="h-3 w-3 text-green-600" />
            <span className="text-muted-foreground">{job.assignedToName}</span>
          </div>
        )}
        {job.scoutNotes && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{job.scoutNotes}</p>
        )}
        {onAssign && job.status === 'pending' && (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 w-full"
            onClick={(e) => {
              e.stopPropagation();
              onAssign();
            }}
          >
            <UserCheck className="h-3 w-3 mr-1" />
            Assign
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TaskGroupCard({
  group,
  onCreateJob,
}: {
  group: TaskGroup;
  onCreateJob: () => void;
}) {
  return (
    <Card className="cursor-pointer transition-all hover:shadow-md border-dashed">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          {group.isTankMix ? (
            <Beaker className="h-4 w-4 text-purple-600" />
          ) : (
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          )}
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {group.isTankMix ? group.tankMixProducts?.join(' + ') : group.productName}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {group.locations.length}
          </span>
          <span className="flex items-center gap-1">
            <Leaf className="h-3 w-3" />
            {group.totalBatches}
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="mt-3 w-full"
          onClick={onCreateJob}
        >
          <Plus className="h-3 w-3 mr-1" />
          Create Job
        </Button>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  title,
  icon: Icon,
  jobs,
  taskGroups,
  color,
  onJobAssign,
  onJobView,
  onCreateJob,
}: {
  title: string;
  icon: React.ElementType;
  jobs: IpmJob[];
  taskGroups?: TaskGroup[];
  color: string;
  onJobAssign?: (job: IpmJob) => void;
  onJobView?: (job: IpmJob) => void;
  onCreateJob?: (group: TaskGroup) => void;
}) {
  const count = jobs.length + (taskGroups?.length || 0);

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px]">
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg', color)}>
        <Icon className="h-4 w-4" />
        <span className="font-medium text-sm">{title}</span>
        <Badge variant="secondary" className="ml-auto">
          {count}
        </Badge>
      </div>
      <div className="flex-1 bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-320px)] overflow-y-auto">
        {/* Ungrouped tasks (no job yet) */}
        {taskGroups?.map((group, idx) => (
          <TaskGroupCard
            key={`group-${idx}`}
            group={group}
            onCreateJob={() => onCreateJob?.(group)}
          />
        ))}
        {/* Jobs */}
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onAssign={onJobAssign ? () => onJobAssign(job) : undefined}
            onView={onJobView ? () => onJobView(job) : undefined}
          />
        ))}
        {count === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No items
          </div>
        )}
      </div>
    </div>
  );
}

export function ScoutCommandCenter({
  jobsByStatus,
  taskGroups,
  calendarWeek,
  onWeekChange,
  onRefresh,
}: Props) {
  const [createJobGroup, setCreateJobGroup] = useState<TaskGroup | null>(null);
  const [assigningJob, setAssigningJob] = useState<IpmJob | null>(null);
  const [viewingJob, setViewingJob] = useState<IpmJob | null>(null);

  // Filter task groups to only show those without jobs
  const ungroupedTasks = taskGroups.filter((group) => {
    // Check if any job exists for this group key
    const allJobs = [
      ...jobsByStatus.pending,
      ...jobsByStatus.assigned,
      ...jobsByStatus.inProgress,
      ...jobsByStatus.completed,
    ];
    return !allJobs.some((job) => job.groupKey === group.groupKey);
  });

  const handleCreateJob = async (group: TaskGroup) => {
    const result = await createJob({
      groupKey: group.groupKey,
      calendarWeek: group.calendarWeek,
      scheduledDate: group.weekStartDate,
      name: group.isTankMix ? group.tankMixProducts?.join(' + ') : group.productName,
    });

    if (result.success) {
      toast.success('Job created');
      onRefresh();
    } else {
      toast.error(result.error || 'Failed to create job');
    }
  };

  const totalJobs =
    jobsByStatus.pending.length +
    jobsByStatus.assigned.length +
    jobsByStatus.inProgress.length;

  return (
    <div className="space-y-4">
      {/* Week selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onWeekChange(calendarWeek - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[100px]">
            <span className="font-medium">Week {calendarWeek}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => onWeekChange(calendarWeek + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {totalJobs} active job{totalJobs !== 1 ? 's' : ''}
          </Badge>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        <KanbanColumn
          title="Unassigned"
          icon={Clock}
          jobs={jobsByStatus.pending}
          taskGroups={ungroupedTasks}
          color="bg-slate-100 text-slate-700"
          onJobAssign={setAssigningJob}
          onJobView={setViewingJob}
          onCreateJob={handleCreateJob}
        />
        <KanbanColumn
          title="Assigned"
          icon={UserCheck}
          jobs={jobsByStatus.assigned}
          color="bg-blue-100 text-blue-700"
          onJobView={setViewingJob}
        />
        <KanbanColumn
          title="In Progress"
          icon={Play}
          jobs={jobsByStatus.inProgress}
          color="bg-amber-100 text-amber-700"
          onJobView={setViewingJob}
        />
        <KanbanColumn
          title="Completed"
          icon={CheckCircle2}
          jobs={jobsByStatus.completed}
          color="bg-green-100 text-green-700"
          onJobView={setViewingJob}
        />
      </div>

      {/* Assign Job Sheet */}
      <AssignJobSheet
        job={assigningJob}
        open={!!assigningJob}
        onOpenChange={(open) => !open && setAssigningJob(null)}
        onAssigned={() => {
          setAssigningJob(null);
          onRefresh();
        }}
      />

      {/* View Job Sheet */}
      <Sheet open={!!viewingJob} onOpenChange={(open) => !open && setViewingJob(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {viewingJob?.product.isTankMix ? (
                <Beaker className="h-5 w-5 text-purple-600" />
              ) : (
                <FlaskConical className="h-5 w-5 text-primary" />
              )}
              {viewingJob?.name}
            </SheetTitle>
            <SheetDescription>
              {viewingJob?.product.method}
              {viewingJob?.product.rate && ` @ ${viewingJob.product.rate} ${viewingJob.product.rateUnit}`}
            </SheetDescription>
          </SheetHeader>
          {viewingJob && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium capitalize">{viewingJob.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Priority</span>
                  <p className="font-medium capitalize">{viewingJob.priority}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Locations</span>
                  <p className="font-medium">{viewingJob.locationCount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Batches</span>
                  <p className="font-medium">{viewingJob.batchCount}</p>
                </div>
                {viewingJob.assignedToName && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Assigned To</span>
                    <p className="font-medium">{viewingJob.assignedToName}</p>
                  </div>
                )}
              </div>

              {viewingJob.scoutNotes && (
                <div>
                  <span className="text-sm text-muted-foreground">Scout Notes</span>
                  <p className="mt-1 text-sm bg-muted/50 rounded-lg p-3">{viewingJob.scoutNotes}</p>
                </div>
              )}

              {/* Location list */}
              <div>
                <span className="text-sm text-muted-foreground">Locations</span>
                <div className="mt-2 space-y-2">
                  {viewingJob.locations.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{loc.name}</span>
                      </div>
                      <Badge variant="secondary">
                        {loc.completedCount}/{loc.taskCount} done
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {viewingJob.status === 'pending' && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setViewingJob(null);
                    setAssigningJob(viewingJob);
                  }}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign Job
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
