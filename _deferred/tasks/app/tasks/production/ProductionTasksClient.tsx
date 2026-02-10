"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { Plus, RefreshCw, Filter, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModulePageHeader } from '@/ui/templates';
import { JobsKanban } from "@/app/tasks/components/JobsKanban";
import { CreateJobDialog } from "@/app/tasks/components/CreateJobDialog";
import { TaskWizard } from "@/app/tasks/components/TaskWizard";
import { toast } from "@/lib/toast";
import { fetchJson } from "@/lib/http/fetchJson";
import type { StaffMember } from "@/server/tasks/service";
import type { ProductionJob, JobBatch } from "@/server/production/jobs";
import type { ChecklistProgress } from "@/server/tasks/checklist-service";

type Props = {
  initialJobs: ProductionJob[];
  staff: StaffMember[];
  availableBatches: JobBatch[];
};

type JobsResponse = { jobs: ProductionJob[] };
type BatchesResponse = { batches: JobBatch[] };

export default function ProductionTasksClient({ initialJobs, staff, availableBatches: initialBatches }: Props) {
  const [isCreateJobOpen, setIsCreateJobOpen] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<ProductionJob | null>(null);
  const [selectedJobBatches, setSelectedJobBatches] = React.useState<JobBatch[]>([]);
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const [processTypeFilter, setProcessTypeFilter] = React.useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>("all");

  // Fetch jobs
  const {
    data: jobsData,
    mutate: mutateJobs,
    isValidating: jobsLoading,
  } = useSWR<JobsResponse>(
    "/api/tasks/jobs",
    (url) => fetchJson(url),
    { fallbackData: { jobs: initialJobs } }
  );

  // Fetch available ghost batches
  const {
    data: batchesData,
    mutate: mutateBatches,
  } = useSWR<BatchesResponse>(
    "/api/tasks/jobs?availableBatches=true",
    (url) => fetchJson(url),
    { fallbackData: { batches: initialBatches } }
  );

  const allJobs = React.useMemo(() => jobsData?.jobs ?? [], [jobsData]);
  const availableBatches = React.useMemo(() => batchesData?.batches ?? [], [batchesData]);

  // Filter jobs
  const jobs = React.useMemo(() => {
    return allJobs.filter((job) => {
      if (processTypeFilter !== "all" && job.processType !== processTypeFilter) {
        return false;
      }
      if (assigneeFilter !== "all" && job.assignedTo !== assigneeFilter) {
        return false;
      }
      return true;
    });
  }, [allJobs, processTypeFilter, assigneeFilter]);

  // Stats
  const stats = React.useMemo(() => {
    const unassigned = allJobs.filter((j) => j.status === "unassigned").length;
    const assigned = allJobs.filter((j) => j.status === "assigned").length;
    const inProgress = allJobs.filter((j) => j.status === "in_progress").length;
    const totalPlants = allJobs
      .filter((j) => ["unassigned", "assigned", "in_progress"].includes(j.status))
      .reduce((sum, j) => sum + j.totalPlants, 0);

    return { unassigned, assigned, inProgress, totalPlants };
  }, [allJobs]);

  // Handlers
  const handleCreateJob = async (values: {
    name: string;
    description?: string;
    processType?: string;
    machine?: string;
    location?: string;
    scheduledWeek?: number;
    scheduledYear?: number;
    batchIds: string[];
  }) => {
    try {
      await fetchJson("/api/tasks/jobs", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Job created successfully");
      mutateJobs();
      mutateBatches();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create job");
      throw error;
    }
  };

  const handleAssignJob = async (job: ProductionJob, staffId: string) => {
    try {
      await fetchJson(`/api/tasks/jobs/${job.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assignedTo: staffId }),
      });
      toast.success("Job assigned");
      mutateJobs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign job");
    }
  };

  const handleStartJob = async (job: ProductionJob) => {
    try {
      await fetchJson(`/api/tasks/jobs/${job.id}/start`, { method: "POST" });
      toast.success("Job started");
      mutateJobs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start job");
    }
  };

  const handleCompleteJob = async (job: ProductionJob) => {
    try {
      await fetchJson(`/api/tasks/jobs/${job.id}/complete`, { method: "POST" });
      toast.success("Job completed");
      mutateJobs();
      mutateBatches();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete job");
    }
  };

  const handleDeleteJob = async (job: ProductionJob) => {
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return;
    try {
      await fetchJson(`/api/tasks/jobs/${job.id}`, { method: "DELETE" });
      toast.success("Job deleted");
      mutateJobs();
      mutateBatches();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete job");
    }
  };

  const handleOpenJob = async (job: ProductionJob) => {
    setSelectedJob(job);
    try {
      const response = await fetchJson<{ job: ProductionJob; batches: JobBatch[] }>(
        `/api/tasks/jobs/${job.id}?includeBatches=true`
      );
      setSelectedJobBatches(response.batches);
      setIsWizardOpen(true);
    } catch (error) {
      console.error("Failed to fetch job details:", error);
      setSelectedJobBatches([]);
      setIsWizardOpen(true);
    }
  };

  const handleWizardStart = async () => {
    if (!selectedJob) return;
    await handleStartJob(selectedJob);
    mutateJobs();
  };

  const handleWizardComplete = async (wizardData: Record<string, unknown>) => {
    if (!selectedJob) return;
    try {
      await fetchJson(`/api/tasks/jobs/${selectedJob.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ wizardData }),
      });
      toast.success("Job completed successfully!");
      setIsWizardOpen(false);
      setSelectedJob(null);
      mutateJobs();
      mutateBatches();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete job");
      throw error;
    }
  };

  const handleWizardAssign = async (staffId: string) => {
    if (!selectedJob) return;
    try {
      await fetchJson(`/api/tasks/jobs/${selectedJob.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assignedTo: staffId }),
      });
      toast.success("Job assigned");
      mutateJobs();
      // Update selected job state
      const assignee = staff.find((s) => s.id === staffId);
      setSelectedJob((prev) => prev ? { ...prev, assignedTo: staffId, assignedToName: assignee?.name ?? null, status: "assigned" } : null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign job");
    }
  };

  const handleWizardUpdate = async (updates: { name?: string; location?: string; processType?: string; machine?: string }) => {
    if (!selectedJob) return;
    try {
      await fetchJson(`/api/tasks/jobs/${selectedJob.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      toast.success("Job updated");
      mutateJobs();
      // Update selected job state with proper typing
      setSelectedJob((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          name: updates.name ?? prev.name,
          location: updates.location ?? prev.location,
          processType: (updates.processType as ProductionJob["processType"]) ?? prev.processType,
          machine: updates.machine ?? prev.machine,
        };
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update job");
    }
  };

  const handleChecklistUpdate = async (checklistProgress: ChecklistProgress) => {
    if (!selectedJob) return;
    try {
      await fetchJson(`/api/tasks/jobs/${selectedJob.id}`, {
        method: "PATCH",
        body: JSON.stringify({ checklistProgress }),
      });
      // Update selected job state silently (no toast for frequent updates)
      setSelectedJob((prev) => prev ? { ...prev, checklistProgress } : null);
    } catch (error) {
      console.error("Failed to save checklist progress:", error);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <ModulePageHeader
          title="Production Tasks"
          description="Manage and assign production jobs to staff."
          actionsSlot={
            <>
              <Link href="/tasks">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Overview
                </Button>
              </Link>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  mutateJobs();
                  mutateBatches();
                }}
                disabled={jobsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${jobsLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button onClick={() => setIsCreateJobOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Job
              </Button>
            </>
          }
        />

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unassigned</CardDescription>
              <CardTitle className="text-3xl text-red-600">{stats.unassigned}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Assigned</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.assigned}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl text-amber-600">{stats.inProgress}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Plants in Queue</CardDescription>
              <CardTitle className="text-3xl">{stats.totalPlants.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={processTypeFilter} onValueChange={setProcessTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Process Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="potting">Potting</SelectItem>
              <SelectItem value="propagation">Propagation</SelectItem>
              <SelectItem value="transplant">Transplant</SelectItem>
              <SelectItem value="spacing">Spacing</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(processTypeFilter !== "all" || assigneeFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setProcessTypeFilter("all");
                setAssigneeFilter("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Kanban Board */}
        <JobsKanban
          jobs={jobs}
          staff={staff}
          onAssign={handleAssignJob}
          onStart={handleStartJob}
          onComplete={handleCompleteJob}
          onDelete={handleDeleteJob}
          onOpenJob={handleOpenJob}
        />
      </div>

      {/* Create Job Dialog */}
      <CreateJobDialog
        open={isCreateJobOpen}
        onOpenChange={setIsCreateJobOpen}
        availableBatches={availableBatches}
        onSubmit={handleCreateJob}
      />

      {/* Task Wizard Dialog */}
      <TaskWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        job={selectedJob}
        batches={selectedJobBatches}
        staff={staff}
        onStart={handleWizardStart}
        onComplete={handleWizardComplete}
        onAssign={handleWizardAssign}
        onUpdate={handleWizardUpdate}
        onChecklistUpdate={handleChecklistUpdate}
      />
    </>
  );
}

