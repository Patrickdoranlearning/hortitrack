"use client";

import * as React from "react";
import useSWR from "swr";
import {
  Layers,
  Play,
  User,
  Pencil,
  MapPin,
  Settings2,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActualizeWizard } from "@/components/production/actualize";
import { JobChecklist, isChecklistComplete, initializeProgressFromTemplates } from "@/components/tasks";
import { fetchJson } from "@/lib/http/fetchJson";
import type { PlannedBatch } from "@/components/production/actualize";
import type { ProductionJob, JobBatch } from "@/server/production/jobs";
import type { StaffMember } from "@/server/tasks/service";
import type { ChecklistTemplate, ChecklistProgress } from "@/server/tasks/checklist-service";

const PROCESS_TYPES = [
  { value: "potting", label: "Potting" },
  { value: "propagation", label: "Propagation" },
  { value: "transplant", label: "Transplant" },
  { value: "spacing", label: "Spacing" },
  { value: "other", label: "Other" },
] as const;

// Convert JobBatch to PlannedBatch format for ActualizeWizard
function convertToPlannedBatches(jobBatches: JobBatch[]): PlannedBatch[] {
  return jobBatches.map((batch) => ({
    id: batch.batchId,
    batchNumber: batch.batchNumber ?? '',
    varietyId: '',
    varietyName: batch.varietyName ?? 'Unknown',
    varietyFamily: null,
    sizeId: '',
    sizeName: batch.sizeName ?? 'Unknown',
    quantity: batch.quantity,
    status: batch.status ?? 'Planned',
    phase: 'potted',
    locationId: null,
    locationName: null,
    plannedDate: batch.readyAt,
    parentBatchId: null,
    parentBatchNumber: null,
  }));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: ProductionJob | null;
  batches: JobBatch[];
  staff?: StaffMember[];
  onStart: () => Promise<void>;
  onComplete: (wizardData: Record<string, unknown>) => Promise<void>;
  onAssign?: (staffId: string) => Promise<void>;
  onUpdate?: (updates: { name?: string; location?: string; processType?: string; machine?: string }) => Promise<void>;
  onChecklistUpdate?: (progress: ChecklistProgress) => Promise<void>;
};

type TemplatesResponse = { templates: ChecklistTemplate[] };

export function TaskWizard({
  open,
  onOpenChange,
  job,
  batches,
  staff = [],
  onStart,
  onComplete,
  onAssign,
  onUpdate,
  onChecklistUpdate,
}: Props) {
  const [isStarting, setIsStarting] = React.useState(false);
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<"overview" | "prepare" | "execute" | "complete" | "edit">("overview");
  const [checklistProgress, setChecklistProgress] = React.useState<ChecklistProgress>({
    prerequisites: [],
    postrequisites: [],
  });

  // Edit form state
  const [editName, setEditName] = React.useState("");
  const [editLocation, setEditLocation] = React.useState("");
  const [editMachine, setEditMachine] = React.useState("");
  const [editProcessType, setEditProcessType] = React.useState("");
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);

  // Fetch checklist templates for this process type
  const processType = job?.processType ?? "other";
  const { data: templatesData } = useSWR<TemplatesResponse>(
    open && job ? `/api/settings/checklists?sourceModule=production&processType=${processType}&isActive=true` : null,
    (url: string) => fetchJson<TemplatesResponse>(url)
  );

  const allTemplates = templatesData?.templates ?? [];
  const prerequisiteTemplates = allTemplates.filter((t) => t.checklistType === "prerequisite");
  const postrequisiteTemplates = allTemplates.filter((t) => t.checklistType === "postrequisite");

  // Convert batches to PlannedBatch format for ActualizeWizard
  const plannedBatches = React.useMemo(() => {
    return convertToPlannedBatches(batches);
  }, [batches]);

  // Track elapsed time when job is in progress
  React.useEffect(() => {
    if (!open || !job?.startedAt) return;

    const start = new Date(job.startedAt);

    const interval = setInterval(() => {
      const now = new Date();
      setElapsedTime(Math.floor((now.getTime() - start.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [open, job?.startedAt]);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open && job) {
      // Initialize edit form
      setEditName(job.name);
      setEditLocation(job.location || "");
      setEditMachine(job.machine || "");
      setEditProcessType(job.processType || "");

      // Initialize checklist progress from job or templates
      const hasProgress = job.checklistProgress &&
        Array.isArray(job.checklistProgress.prerequisites) &&
        Array.isArray(job.checklistProgress.postrequisites) &&
        (job.checklistProgress.prerequisites.length > 0 || job.checklistProgress.postrequisites.length > 0);

      if (hasProgress) {
        setChecklistProgress(job.checklistProgress);
      } else if (allTemplates.length > 0) {
        setChecklistProgress(initializeProgressFromTemplates(allTemplates));
      }

      // Set initial tab based on job status
      if (job.status === "in_progress") {
        setActiveTab("execute");
      } else if (job.status === "assigned" && prerequisiteTemplates.length > 0) {
        setActiveTab("prepare");
      } else {
        setActiveTab("overview");
      }
    }
  }, [open, job, allTemplates, prerequisiteTemplates.length]);

  const isJobStarted = job?.status === "in_progress";
  const canEdit = job?.status !== "completed" && job?.status !== "in_progress";
  const hasPrerequisites = prerequisiteTemplates.length > 0;
  const hasPostrequisites = postrequisiteTemplates.length > 0;

  // Check prerequisite completion status
  const prereqStatus = React.useMemo(() => {
    if (!hasPrerequisites) return "complete";
    return isChecklistComplete(prerequisiteTemplates, checklistProgress, "prerequisite");
  }, [hasPrerequisites, prerequisiteTemplates, checklistProgress]);

  // Check postrequisite completion status
  const postreqStatus = React.useMemo(() => {
    if (!hasPostrequisites) return "complete";
    return isChecklistComplete(postrequisiteTemplates, checklistProgress, "postrequisite");
  }, [hasPostrequisites, postrequisiteTemplates, checklistProgress]);

  const handleChecklistChange = async (progress: ChecklistProgress) => {
    setChecklistProgress(progress);
    if (onChecklistUpdate) {
      await onChecklistUpdate(progress);
    }
  };

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await onStart();
      setActiveTab("execute");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartWithWarning = async () => {
    // Show warning for incomplete prerequisites but allow start
    if (prereqStatus === "incomplete") {
      const confirmed = window.confirm(
        "Some prerequisite items are incomplete. Are you sure you want to start?"
      );
      if (!confirmed) return;
    }
    await handleStart();
  };

  // Handler for when ActualizeWizard completes
  const handleActualizeComplete = async (result: unknown) => {
    // If there are postrequisites, go to complete tab
    if (hasPostrequisites) {
      setActiveTab("complete");
      return;
    }

    // Otherwise complete directly
    await finalizeCompletion(result);
  };

  const finalizeCompletion = async (actualizeResult?: unknown) => {
    setIsCompleting(true);
    try {
      await onComplete({
        actualizeResult,
        checklistProgress,
        completedVia: 'task_wizard',
        completedAt: new Date().toISOString(),
        elapsedSeconds: elapsedTime,
      });
      onOpenChange(false);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCompleteWithWarning = async () => {
    if (postreqStatus === "incomplete") {
      const confirmed = window.confirm(
        "Some postrequisite items are incomplete. Are you sure you want to complete?"
      );
      if (!confirmed) return;
    }
    await finalizeCompletion();
  };

  const handleAssign = async (staffId: string) => {
    if (!onAssign) return;
    setIsAssigning(true);
    try {
      await onAssign(staffId);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!onUpdate) return;
    setIsSaving(true);
    try {
      await onUpdate({
        name: editName,
        location: editLocation || undefined,
        machine: editMachine || undefined,
        processType: editProcessType || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  if (!job) return null;

  // Determine available tabs based on status and templates
  const tabCount = 2 + (hasPrerequisites ? 1 : 0) + (hasPostrequisites && isJobStarted ? 1 : 0) + (canEdit ? 1 : 0);
  const tabGridCols = tabCount <= 3 ? `grid-cols-${tabCount}` : "grid-cols-4";

  return (
    <Dialog open={open} onOpenChange={(value) => !isStarting && !isCompleting && onOpenChange(value)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {job.name}
            {isJobStarted && (
              <Badge variant="secondary" className="ml-2">
                <Clock className="mr-1 h-3 w-3" />
                {formatElapsedTime(elapsedTime)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {job.processType && <span className="capitalize">{job.processType}</span>}
            {job.location && ` · ${job.location}`}
            {job.machine && ` · ${job.machine}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className={`grid w-full ${tabGridCols}`}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {hasPrerequisites && (
              <TabsTrigger value="prepare" className="gap-1">
                Prepare
                {prereqStatus === "complete" && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                {prereqStatus === "incomplete" && <AlertTriangle className="h-3 w-3 text-amber-600" />}
              </TabsTrigger>
            )}
            <TabsTrigger value="execute" disabled={!isJobStarted}>
              Execute
            </TabsTrigger>
            {hasPostrequisites && isJobStarted && (
              <TabsTrigger value="complete" className="gap-1">
                Complete
                {postreqStatus === "complete" && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                {postreqStatus === "incomplete" && <AlertTriangle className="h-3 w-3 text-amber-600" />}
              </TabsTrigger>
            )}
            {canEdit && (
              <TabsTrigger value="edit">Edit</TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto space-y-4 mt-4">
            {/* Job Summary */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-4">
                  <Badge variant={isJobStarted ? "default" : "secondary"}>
                    {isJobStarted ? "In Progress" : job.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    {job.batchCount} batch{job.batchCount !== 1 ? "es" : ""} ·{" "}
                    {job.totalPlants.toLocaleString()} plants
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assignment Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Assignment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {job.assignedToName ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{job.assignedToName}</div>
                        <div className="text-xs text-muted-foreground">Assigned</div>
                      </div>
                    </div>
                    {canEdit && staff.length > 0 && (
                      <Select
                        value={job.assignedTo || ""}
                        onValueChange={handleAssign}
                        disabled={isAssigning}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Reassign..." />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">This job is not assigned to anyone yet.</p>
                    {staff.length > 0 && (
                      <Select
                        value=""
                        onValueChange={(val) => {
                          if (val && val !== "__none__") {
                            handleAssign(val);
                          }
                        }}
                        disabled={isAssigning}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff member..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Select staff member...</SelectItem>
                          {staff.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Start Button (if not started) */}
            {!isJobStarted && job.status !== "completed" && (
              <Alert>
                <Play className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    {hasPrerequisites
                      ? "Review prerequisites first, then start the job."
                      : "Ready to start this job? Time tracking will begin automatically."}
                  </span>
                  <Button
                    size="sm"
                    onClick={hasPrerequisites ? () => setActiveTab("prepare") : handleStart}
                    disabled={isStarting}
                  >
                    {hasPrerequisites ? "Review Prerequisites" : isStarting ? "Starting..." : "Start Job"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Batches in Job */}
            {batches.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Batches in this Job</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {batches.map((batch) => (
                    <div
                      key={batch.batchId}
                      className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                    >
                      <div>
                        <span className="font-medium">{batch.varietyName}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {batch.batchNumber} · {batch.sizeName}
                        </span>
                      </div>
                      <Badge variant="outline">{batch.quantity.toLocaleString()}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Prepare Tab - Prerequisites */}
          {hasPrerequisites && (
            <TabsContent value="prepare" className="flex-1 overflow-y-auto space-y-4 mt-4">
              <JobChecklist
                templates={prerequisiteTemplates}
                progress={checklistProgress}
                checklistType="prerequisite"
                onProgressChange={handleChecklistChange}
                disabled={isJobStarted}
              />

              {!isJobStarted && job.status !== "completed" && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    onClick={handleStartWithWarning}
                    disabled={isStarting}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {isStarting ? "Starting..." : "Start Job"}
                  </Button>
                </div>
              )}
            </TabsContent>
          )}

          {/* Execute Tab - Actualize Wizard */}
          <TabsContent value="execute" className="flex-1 overflow-y-auto mt-4">
            {isJobStarted && plannedBatches.length > 0 && (
              <ActualizeWizard
                initialBatches={plannedBatches}
                jobId={job.id}
                onComplete={handleActualizeComplete}
                onCancel={() => setActiveTab("overview")}
              />
            )}

            {isJobStarted && plannedBatches.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No batches in this job to actualize.</p>
                <p className="text-sm mt-2">Add batches to the job from the Overview tab.</p>
                {hasPostrequisites ? (
                  <Button className="mt-4" onClick={() => setActiveTab("complete")}>
                    Continue to Completion
                  </Button>
                ) : (
                  <Button className="mt-4" onClick={() => finalizeCompletion()}>
                    Complete Job
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Complete Tab - Postrequisites */}
          {hasPostrequisites && isJobStarted && (
            <TabsContent value="complete" className="flex-1 overflow-y-auto space-y-4 mt-4">
              <Alert className="mb-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Almost Done!</AlertTitle>
                <AlertDescription>
                  Complete the postrequisites below, then finalize the job.
                </AlertDescription>
              </Alert>

              <JobChecklist
                templates={postrequisiteTemplates}
                progress={checklistProgress}
                checklistType="postrequisite"
                onProgressChange={handleChecklistChange}
              />

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  onClick={handleCompleteWithWarning}
                  disabled={isCompleting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isCompleting ? "Completing..." : "Complete Job"}
                </Button>
              </div>
            </TabsContent>
          )}

          {/* Edit Tab */}
          {canEdit && (
            <TabsContent value="edit" className="flex-1 overflow-y-auto space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Job Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Job name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-process">Process Type</Label>
                  <Select value={editProcessType} onValueChange={setEditProcessType}>
                    <SelectTrigger id="edit-process">
                      <SelectValue placeholder="Select process type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCESS_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location / Tunnel</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-location"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="e.g., Tunnel 3"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-machine">Machine</Label>
                  <div className="relative">
                    <Settings2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-machine"
                      value={editMachine}
                      onChange={(e) => setEditMachine(e.target.value)}
                      placeholder="e.g., Potting Machine 1"
                      className="pl-9"
                    />
                  </div>
                </div>

                {onUpdate && (
                  <Button
                    onClick={handleSaveEdits}
                    disabled={isSaving || !editName.trim()}
                    className="w-full"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
