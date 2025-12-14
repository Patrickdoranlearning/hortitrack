"use client";

import * as React from "react";
import useSWR from "swr";
import { Plus, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import { JobsKanban } from "@/app/tasks/components/JobsKanban";
import { CreateJobDialog } from "@/app/tasks/components/CreateJobDialog";
import { TaskWizard } from "@/app/tasks/components/TaskWizard";
import { ActualizeWizardDialog } from "@/components/production/actualize";
import type { PlannedBatch } from "@/components/production/actualize";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/http/fetchJson";
import type { StaffMember } from "@/server/tasks/service";
import type { ProductionJob, JobBatch } from "@/server/production/jobs";

type Props = {
  initialJobs: ProductionJob[];
  staff: StaffMember[];
  availableBatches: JobBatch[];
};

type JobsResponse = { jobs: ProductionJob[] };
type BatchesResponse = { batches: JobBatch[] };

export default function ProductionJobsClient({ initialJobs, staff, availableBatches: initialBatches }: Props) {
  const { toast } = useToast();
  const [isCreateJobOpen, setIsCreateJobOpen] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<ProductionJob | null>(null);
  const [selectedJobBatches, setSelectedJobBatches] = React.useState<JobBatch[]>([]);
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const [isActualizeWizardOpen, setIsActualizeWizardOpen] = React.useState(false);
  const [actualizeJobBatches, setActualizeJobBatches] = React.useState<PlannedBatch[]>([]);
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

  // Convert JobBatch to PlannedBatch format for Actualize Wizard
  const convertToPlannedBatches = React.useCallback((jobBatches: JobBatch[]): PlannedBatch[] => {
    return jobBatches.map((batch) => ({
      id: batch.batchId,
      batchNumber: batch.batchNumber ?? '',
      varietyId: '', // Not available from JobBatch
      varietyName: batch.varietyName ?? 'Unknown',
      varietyFamily: null,
      sizeId: '', // Not available from JobBatch
      sizeName: batch.sizeName ?? 'Unknown',
      quantity: batch.quantity,
      status: batch.status ?? 'Planned',
      phase: 'potted', // Default phase
      locationId: null,
      locationName: null,
      plannedDate: batch.readyAt,
      parentBatchId: null,
      parentBatchNumber: null,
    }));
  }, []);

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
      toast({ title: "Job created successfully" });
      mutateJobs();
      mutateBatches();
    } catch (error) {
      toast({
        title: "Failed to create job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleAssignJob = async (job: ProductionJob, staffId: string) => {
    try {
      await fetchJson(`/api/tasks/jobs/${job.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assignedTo: staffId }),
      });
      toast({ title: "Job assigned" });
      mutateJobs();
    } catch (error) {
      toast({
        title: "Failed to assign job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleStartJob = async (job: ProductionJob) => {
    try {
      await fetchJson(`/api/tasks/jobs/${job.id}/start`, { method: "POST" });
      toast({ title: "Job started" });
      mutateJobs();
    } catch (error) {
      toast({
        title: "Failed to start job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleCompleteJob = async (job: ProductionJob) => {
    try {
      await fetchJson(`/api/tasks/jobs/${job.id}/complete`, { method: "POST" });
      toast({ title: "Job completed" });
      mutateJobs();
      mutateBatches();
    } catch (error) {
      toast({
        title: "Failed to complete job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDeleteJob = async (job: ProductionJob) => {
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return;
    try {
      await fetchJson(`/api/tasks/jobs/${job.id}`, { method: "DELETE" });
      toast({ title: "Job deleted" });
      mutateJobs();
      mutateBatches();
    } catch (error) {
      toast({
        title: "Failed to delete job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
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

  // Handler to execute a job using the Actualize Wizard
  const handleExecuteJob = async (job: ProductionJob) => {
    setSelectedJob(job);
    try {
      // First, start the job if not already started
      if (job.status !== "in_progress") {
        await fetchJson(`/api/tasks/jobs/${job.id}/start`, { method: "POST" });
        mutateJobs();
      }

      // Fetch job batches
      const response = await fetchJson<{ job: ProductionJob; batches: JobBatch[] }>(
        `/api/tasks/jobs/${job.id}?includeBatches=true`
      );

      // Convert to PlannedBatch format and open Actualize Wizard
      const plannedBatches = convertToPlannedBatches(response.batches);
      setActualizeJobBatches(plannedBatches);
      setIsActualizeWizardOpen(true);
    } catch (error) {
      console.error("Failed to start job execution:", error);
      toast({
        title: "Failed to start job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Handler for when Actualize Wizard completes
  const handleActualizeWizardComplete = async (result: any) => {
    if (!selectedJob) return;

    try {
      // Mark the job as completed
      await fetchJson(`/api/tasks/jobs/${selectedJob.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          wizardData: {
            actualizeResult: result,
            completedVia: 'actualize_wizard'
          }
        }),
      });
      toast({ title: "Job completed successfully!" });
      setIsActualizeWizardOpen(false);
      setSelectedJob(null);
      setActualizeJobBatches([]);
      mutateJobs();
      mutateBatches();
    } catch (error) {
      toast({
        title: "Failed to complete job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
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
      toast({ title: "Job completed successfully!" });
      setIsWizardOpen(false);
      setSelectedJob(null);
      mutateJobs();
      mutateBatches();
    } catch (error) {
      toast({
        title: "Failed to complete job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
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
      toast({ title: "Job assigned" });
      mutateJobs();
      // Update selected job state
      const assignee = staff.find((s) => s.id === staffId);
      setSelectedJob((prev) => prev ? { ...prev, assignedTo: staffId, assignedToName: assignee?.name ?? null, status: "assigned" } : null);
    } catch (error) {
      toast({
        title: "Failed to assign job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleWizardUpdate = async (updates: { name?: string; location?: string; processType?: string; machine?: string }) => {
    if (!selectedJob) return;
    try {
      await fetchJson(`/api/tasks/jobs/${selectedJob.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      toast({ title: "Job updated" });
      mutateJobs();
      // Update selected job state
      setSelectedJob((prev) => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      toast({
        title: "Failed to update job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        <ModulePageHeader
          title="Production Jobs"
          description="Create and manage production jobs from ghost batches."
          actionsSlot={
            <>
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
              <CardTitle className="text-3xl text-blue-600">{stats.unassigned}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Assigned</CardDescription>
              <CardTitle className="text-3xl">{stats.assigned}</CardTitle>
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
          onExecuteJob={handleExecuteJob}
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
      />

      {/* Actualize Wizard Dialog */}
      <ActualizeWizardDialog
        open={isActualizeWizardOpen}
        onOpenChange={(open) => {
          setIsActualizeWizardOpen(open);
          if (!open) {
            setSelectedJob(null);
            setActualizeJobBatches([]);
          }
        }}
        initialBatches={actualizeJobBatches}
        jobId={selectedJob?.id}
        onComplete={handleActualizeWizardComplete}
      />
    </>
  );
}

