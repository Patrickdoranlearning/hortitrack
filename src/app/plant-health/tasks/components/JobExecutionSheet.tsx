'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Beaker,
  FlaskConical,
  MapPin,
  Leaf,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Printer,
  Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import type { IpmJob, JobLocation } from '@/types/ipm-jobs';
import { getJobWithTasks, completeTaskInJob } from '@/app/actions/ipm-tasks';
import { JobCompletionWizard } from './JobCompletionWizard';
import { MixInstructions } from './MixInstructions';
import { cn } from '@/lib/utils';

type Props = {
  job: IpmJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

function LocationSection({
  location,
  onTaskComplete,
}: {
  location: JobLocation;
  onTaskComplete: (taskId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const allCompleted = location.completedCount === location.taskCount;
  const someCompleted = location.completedCount > 0 && !allCompleted;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            'flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors',
            allCompleted ? 'bg-green-50' : 'bg-muted/50 hover:bg-muted'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                allCompleted ? 'bg-green-500' : someCompleted ? 'bg-amber-500' : 'bg-slate-300'
              )}
            />
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{location.name}</span>
            </div>
          </div>
          <Badge variant={allCompleted ? 'default' : 'secondary'} className={allCompleted ? 'bg-green-600' : ''}>
            {location.completedCount}/{location.taskCount}
          </Badge>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-9 mt-2 space-y-2">
          {location.batches.map((batch) => (
            <div
              key={batch.taskId}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg transition-colors',
                batch.isCompleted ? 'bg-green-50/50' : 'hover:bg-muted/30'
              )}
            >
              <Checkbox
                checked={batch.isCompleted}
                onCheckedChange={(checked) => {
                  if (checked && !batch.isCompleted) {
                    onTaskComplete(batch.taskId);
                  }
                }}
                disabled={batch.isCompleted}
              />
              <div className="flex-1 min-w-0">
                <p className={cn('font-medium', batch.isCompleted && 'text-muted-foreground line-through')}>
                  {batch.batchNumber}
                </p>
                {batch.variety && (
                  <p className="text-xs text-muted-foreground">{batch.variety}</p>
                )}
              </div>
              {batch.isCompleted && (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function JobExecutionSheet({ job: initialJob, open, onOpenChange, onComplete }: Props) {
  const [job, setJob] = useState<IpmJob | null>(initialJob);
  const [loading, setLoading] = useState(false);
  const [showCompletionWizard, setShowCompletionWizard] = useState(false);
  const [showMixInstructions, setShowMixInstructions] = useState(false);

  // Refresh job data when opened
  const refreshJob = useCallback(async () => {
    if (!initialJob) return;
    setLoading(true);
    const result = await getJobWithTasks(initialJob.id);
    if (result.success && result.data) {
      setJob(result.data.job);
    }
    setLoading(false);
  }, [initialJob]);

  useEffect(() => {
    if (open && initialJob) {
      refreshJob();
    }
  }, [open, initialJob, refreshJob]);

  const handleTaskComplete = async (taskId: string) => {
    const result = await completeTaskInJob(taskId);
    if (result.success) {
      // Update local state
      setJob((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          completedTaskCount: prev.completedTaskCount + 1,
          locations: prev.locations.map((loc) => ({
            ...loc,
            completedCount: loc.completedCount + (loc.batches.some((b) => b.taskId === taskId) ? 1 : 0),
            batches: loc.batches.map((b) =>
              b.taskId === taskId ? { ...b, isCompleted: true } : b
            ),
          })),
        };
      });
      toast.success('Task completed');
    } else {
      toast.error('Failed to complete task');
    }
  };

  const allTasksCompleted = job && job.completedTaskCount === job.taskCount;
  const progress = job && job.taskCount > 0 ? (job.completedTaskCount / job.taskCount) * 100 : 0;

  if (!job) return null;

  return (
    <>
      <Sheet open={open && !showCompletionWizard} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg flex flex-col h-full">
          <SheetHeader className="shrink-0">
            <SheetTitle className="flex items-center gap-2">
              {job.product.isTankMix ? (
                <Beaker className="h-5 w-5 text-purple-600" />
              ) : (
                <FlaskConical className="h-5 w-5 text-primary" />
              )}
              {job.name}
            </SheetTitle>
            <SheetDescription>
              {job.product.method}
              {job.product.rate && ` @ ${job.product.rate} ${job.product.rateUnit}`}
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="mt-4 shrink-0">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {job.completedTaskCount}/{job.taskCount} batches
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      allTasksCompleted ? 'bg-green-500' : 'bg-primary'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setShowMixInstructions(true)}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Mix Calculator
                </Button>
                <Button variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>

              {/* Scout notes */}
              {job.scoutNotes && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg shrink-0">
                  <p className="text-xs font-medium text-amber-800">Scout Notes</p>
                  <p className="text-sm text-amber-700 mt-1">{job.scoutNotes}</p>
                </div>
              )}

              {/* Walking route - locations list */}
              <div className="mt-4 flex-1 overflow-y-auto">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Walking Route ({job.locations.length} locations)
                </h3>
                <div className="space-y-2">
                  {job.locations.map((location) => (
                    <LocationSection
                      key={location.id}
                      location={location}
                      onTaskComplete={handleTaskComplete}
                    />
                  ))}
                </div>
              </div>

              {/* Complete job button */}
              <div className="mt-4 pt-4 border-t shrink-0">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!allTasksCompleted}
                  onClick={() => setShowCompletionWizard(true)}
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  {allTasksCompleted ? 'Complete Job' : `Complete all ${job.taskCount - job.completedTaskCount} remaining tasks first`}
                </Button>
                {!allTasksCompleted && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Check off all batches above before completing
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Completion Wizard */}
      <JobCompletionWizard
        job={job}
        open={showCompletionWizard}
        onOpenChange={setShowCompletionWizard}
        onComplete={() => {
          setShowCompletionWizard(false);
          onComplete();
        }}
      />

      {/* Mix Instructions */}
      <MixInstructions
        job={job}
        open={showMixInstructions}
        onOpenChange={setShowMixInstructions}
      />
    </>
  );
}
