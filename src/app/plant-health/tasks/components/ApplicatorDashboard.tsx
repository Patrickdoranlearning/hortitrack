'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Beaker,
  FlaskConical,
  MapPin,
  Leaf,
  Play,
  Clock,
  AlertTriangle,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import type { IpmJob } from '@/types/ipm-jobs';
import { startJob } from '@/app/actions/ipm-tasks';
import { JobExecutionSheet } from './JobExecutionSheet';
import { cn } from '@/lib/utils';

type Props = {
  jobs: IpmJob[];
  onRefresh: () => void;
};

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
};

function JobCard({
  job,
  onStart,
  onContinue,
}: {
  job: IpmJob;
  onStart: () => void;
  onContinue: () => void;
}) {
  const isOverdue = new Date(job.scheduledDate) < new Date();
  const isInProgress = job.status === 'in_progress';

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
        job.priority === 'urgent' && 'border-red-300 bg-red-50/50',
        job.priority === 'high' && 'border-amber-300 bg-amber-50/50',
        isOverdue && !isInProgress && 'border-amber-400'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {job.product.isTankMix ? (
              <Beaker className="h-5 w-5 text-purple-600" />
            ) : (
              <FlaskConical className="h-5 w-5 text-primary" />
            )}
            <div>
              <CardTitle className="text-base">{job.name}</CardTitle>
              {job.product.rate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {job.product.method} @ {job.product.rate} {job.product.rateUnit}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {job.priority !== 'normal' && (
              <Badge
                variant="secondary"
                className={cn('text-xs', PRIORITY_COLORS[job.priority])}
              >
                {job.priority}
              </Badge>
            )}
            {isOverdue && !isInProgress && (
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            )}
            {isInProgress && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                <Play className="h-3 w-3 mr-1" />
                In Progress
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {job.locationCount} location{job.locationCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Leaf className="h-4 w-4" />
            {job.batchCount} batch{job.batchCount !== 1 ? 'es' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Week {job.calendarWeek}
          </span>
        </div>

        {/* Progress bar for in-progress jobs */}
        {isInProgress && job.taskCount > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>
                {job.completedTaskCount}/{job.taskCount} tasks
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{
                  width: `${(job.completedTaskCount / job.taskCount) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {job.scoutNotes && (
          <div className="mb-4 p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Scout notes:</p>
            <p className="text-sm mt-1">{job.scoutNotes}</p>
          </div>
        )}

        <Button
          className="w-full"
          variant={isInProgress ? 'default' : 'outline'}
          onClick={isInProgress ? onContinue : onStart}
        >
          {isInProgress ? (
            <>
              <Play className="h-4 w-4 mr-2" />
              Continue Spraying
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start Job
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ApplicatorDashboard({ jobs, onRefresh }: Props) {
  const [executingJob, setExecutingJob] = useState<IpmJob | null>(null);

  const handleStartJob = async (job: IpmJob) => {
    if (job.status === 'assigned') {
      const result = await startJob(job.id);
      if (!result.success) {
        toast.error(result.error || 'Failed to start job');
        return;
      }
    }
    setExecutingJob(job);
  };

  const inProgressJobs = jobs.filter((j) => j.status === 'in_progress');
  const assignedJobs = jobs.filter((j) => j.status === 'assigned');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">My Jobs</h2>
          <p className="text-sm text-muted-foreground">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Empty state */}
      {jobs.length === 0 && (
        <Card className="p-12 text-center">
          <Clock className="h-16 w-16 mx-auto text-muted-foreground/30" />
          <p className="mt-4 text-lg text-muted-foreground">No jobs assigned</p>
          <p className="text-sm text-muted-foreground mt-1">
            Check back later or contact your scout for assignments.
          </p>
        </Card>
      )}

      {/* In Progress Section */}
      {inProgressJobs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Play className="h-4 w-4 text-green-600" />
            In Progress ({inProgressJobs.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {inProgressJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onStart={() => handleStartJob(job)}
                onContinue={() => setExecutingJob(job)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Assigned Section */}
      {assignedJobs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Ready to Start ({assignedJobs.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {assignedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onStart={() => handleStartJob(job)}
                onContinue={() => setExecutingJob(job)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Job Execution Sheet */}
      <JobExecutionSheet
        job={executingJob}
        open={!!executingJob}
        onOpenChange={(open) => !open && setExecutingJob(null)}
        onComplete={() => {
          setExecutingJob(null);
          onRefresh();
        }}
      />
    </div>
  );
}
