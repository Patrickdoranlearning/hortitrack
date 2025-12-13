"use client";

import * as React from "react";
import { User, Calendar, Layers, MoreHorizontal, Play, CheckCircle, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ProductionJob, JobStatus } from "@/server/production/jobs";
import type { StaffMember } from "@/server/tasks/service";

type Props = {
  jobs: ProductionJob[];
  staff: StaffMember[];
  onAssign: (job: ProductionJob, staffId: string) => void;
  onStart: (job: ProductionJob) => void;
  onComplete: (job: ProductionJob) => void;
  onDelete: (job: ProductionJob) => void;
  onOpenJob: (job: ProductionJob) => void;
};

type KanbanColumn = {
  id: JobStatus;
  title: string;
  description: string;
  color: string;
};

const COLUMNS: KanbanColumn[] = [
  {
    id: "unassigned",
    title: "Unassigned",
    description: "Jobs ready to be assigned",
    color: "bg-slate-100 dark:bg-slate-900",
  },
  {
    id: "assigned",
    title: "Assigned",
    description: "Jobs assigned to staff",
    color: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    id: "in_progress",
    title: "In Progress",
    description: "Currently being worked on",
    color: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    id: "completed",
    title: "Completed",
    description: "Finished jobs",
    color: "bg-green-50 dark:bg-green-950/30",
  },
];

export function JobsKanban({ jobs, staff, onAssign, onStart, onComplete, onDelete, onOpenJob }: Props) {
  // Group jobs by status
  const jobsByStatus = React.useMemo(() => {
    const grouped: Record<JobStatus, ProductionJob[]> = {
      draft: [],
      unassigned: [],
      assigned: [],
      in_progress: [],
      completed: [],
      cancelled: [],
    };

    for (const job of jobs) {
      if (grouped[job.status]) {
        grouped[job.status].push(job);
      }
    }

    return grouped;
  }, [jobs]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((column) => (
        <div
          key={column.id}
          className={cn(
            "flex-shrink-0 w-80 rounded-lg p-3",
            column.color
          )}
        >
          {/* Column Header */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{column.title}</h3>
              <Badge variant="secondary">{jobsByStatus[column.id].length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{column.description}</p>
          </div>

          {/* Job Cards */}
          <div className="space-y-3">
            {jobsByStatus[column.id].length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                No jobs
              </div>
            ) : (
              jobsByStatus[column.id].map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  staff={staff}
                  onAssign={onAssign}
                  onStart={onStart}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onOpen={onOpenJob}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

type JobCardProps = {
  job: ProductionJob;
  staff: StaffMember[];
  onAssign: (job: ProductionJob, staffId: string) => void;
  onStart: (job: ProductionJob) => void;
  onComplete: (job: ProductionJob) => void;
  onDelete: (job: ProductionJob) => void;
  onOpen: (job: ProductionJob) => void;
};

function JobCard({ job, staff, onAssign, onStart, onComplete, onDelete, onOpen }: JobCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onOpen(job)}
    >
      <CardHeader className="pb-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium line-clamp-2">{job.name}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2 -mt-1">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(job.status === "unassigned" || job.status === "assigned") && (
                <>
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    {job.status === "unassigned" ? "Assign to..." : "Reassign to..."}
                  </DropdownMenuItem>
                  {staff.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssign(job, member.id);
                      }}
                    >
                      <User className="mr-2 h-4 w-4" />
                      {member.name}
                      {job.assignedTo === member.id && " ✓"}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              {job.status === "assigned" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onStart(job);
                  }}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Job
                </DropdownMenuItem>
              )}
              {job.status === "in_progress" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onComplete(job);
                  }}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Complete Job
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(job);
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(job);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {job.processType && (
          <Badge variant="secondary" className="text-xs capitalize w-fit">
            {job.processType}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {job.batchCount} batch{job.batchCount !== 1 ? "es" : ""}
          </span>
          <span>{job.totalPlants.toLocaleString()} plants</span>
        </div>

        {/* Schedule */}
        {(job.scheduledWeek || job.scheduledDate) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {job.scheduledDate
              ? new Date(job.scheduledDate).toLocaleDateString()
              : `Week ${job.scheduledWeek}, ${job.scheduledYear}`}
          </div>
        )}

        {/* Location/Machine */}
        {(job.location || job.machine) && (
          <div className="text-xs text-muted-foreground">
            {[job.location, job.machine].filter(Boolean).join(" · ")}
          </div>
        )}

        {/* Quick Assign Button for unassigned jobs */}
        {job.status === "unassigned" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" size="sm" className="w-full mt-2">
                <User className="mr-2 h-3 w-3" />
                Assign to Staff
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {staff.map((member) => (
                <DropdownMenuItem
                  key={member.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign(job, member.id);
                  }}
                >
                  <User className="mr-2 h-4 w-4" />
                  {member.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Assignee */}
        {job.assignedToName && (
          <div className="flex items-center gap-1.5 pt-1">
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-3 w-3 text-primary" />
            </div>
            <span className="text-xs font-medium">{job.assignedToName}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

