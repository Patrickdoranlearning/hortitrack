"use client";

import * as React from "react";
import { CheckCircle, Circle, Clock, Layers, Play, ArrowRight, User, Pencil, MapPin, Settings2 } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { cn } from "@/lib/utils";
import type { ProductionJob, JobBatch } from "@/server/production/jobs";
import type { StaffMember } from "@/server/tasks/service";

// Default wizard steps by process type
const WIZARD_TEMPLATES: Record<string, WizardStep[]> = {
  potting: [
    { id: "setup", title: "Setup Machine", description: "Prepare the potting machine and workspace" },
    { id: "materials", title: "Gather Materials", description: "Collect pots, compost, and plant material" },
    { id: "potting", title: "Potting", description: "Pot the plants" },
    { id: "labeling", title: "Labeling", description: "Apply batch labels to containers" },
    { id: "placement", title: "Placement", description: "Move to designated tunnel/location" },
    { id: "cleanup", title: "Cleanup", description: "Clean workspace and equipment" },
  ],
  propagation: [
    { id: "setup", title: "Setup", description: "Prepare propagation area" },
    { id: "materials", title: "Gather Materials", description: "Collect trays, substrate, and cuttings/seeds" },
    { id: "propagate", title: "Propagation", description: "Sow seeds or stick cuttings" },
    { id: "labeling", title: "Labeling", description: "Label trays with batch information" },
    { id: "placement", title: "Placement", description: "Move to propagation house" },
  ],
  transplant: [
    { id: "setup", title: "Setup", description: "Prepare transplant area" },
    { id: "source", title: "Source Plants", description: "Collect plants to be transplanted" },
    { id: "transplant", title: "Transplanting", description: "Move plants to new containers" },
    { id: "labeling", title: "Labeling", description: "Update batch labels" },
    { id: "placement", title: "Placement", description: "Move to growing location" },
  ],
  spacing: [
    { id: "source", title: "Source Plants", description: "Identify plants to space" },
    { id: "spacing", title: "Spacing", description: "Space plants to final positions" },
    { id: "cleanup", title: "Cleanup", description: "Clean up workspace" },
  ],
  default: [
    { id: "start", title: "Start Task", description: "Begin the assigned work" },
    { id: "execute", title: "Execute", description: "Complete the main work" },
    { id: "verify", title: "Verify", description: "Check work is complete" },
  ],
};

const PROCESS_TYPES = [
  { value: "potting", label: "Potting" },
  { value: "propagation", label: "Propagation" },
  { value: "transplant", label: "Transplant" },
  { value: "spacing", label: "Spacing" },
  { value: "other", label: "Other" },
] as const;

type WizardStep = {
  id: string;
  title: string;
  description: string;
};

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
};

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
}: Props) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<Set<string>>(new Set());
  const [isStarting, setIsStarting] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<"overview" | "wizard" | "edit">("overview");
  
  // Edit form state
  const [editName, setEditName] = React.useState("");
  const [editLocation, setEditLocation] = React.useState("");
  const [editMachine, setEditMachine] = React.useState("");
  const [editProcessType, setEditProcessType] = React.useState("");
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Get wizard steps based on process type
  const steps = React.useMemo(() => {
    if (!job) return WIZARD_TEMPLATES.default;
    const template = job.wizardTemplate || job.processType || "default";
    return WIZARD_TEMPLATES[template] || WIZARD_TEMPLATES.default;
  }, [job]);

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
      // Restore progress from job.wizardProgress if available
      const savedProgress = job.wizardProgress as { completedSteps?: string[] } | undefined;
      if (savedProgress?.completedSteps) {
        setCompletedSteps(new Set(savedProgress.completedSteps));
        // Find current step
        const lastCompleted = savedProgress.completedSteps[savedProgress.completedSteps.length - 1];
        const lastIndex = steps.findIndex((s) => s.id === lastCompleted);
        setCurrentStep(Math.min(lastIndex + 1, steps.length - 1));
      } else {
        setCompletedSteps(new Set());
        setCurrentStep(0);
      }
      
      // Initialize edit form
      setEditName(job.name);
      setEditLocation(job.location || "");
      setEditMachine(job.machine || "");
      setEditProcessType(job.processType || "");
      
      // Set initial tab based on job status
      if (job.status === "in_progress") {
        setActiveTab("wizard");
      } else {
        setActiveTab("overview");
      }
    }
  }, [open, job, steps]);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const progress = steps.length > 0 ? (completedSteps.size / steps.length) * 100 : 0;
  const isJobStarted = job?.status === "in_progress";
  const allStepsComplete = completedSteps.size === steps.length;
  const canEdit = job?.status !== "completed" && job?.status !== "in_progress";

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await onStart();
      setActiveTab("wizard");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStepComplete = (stepId: string) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      newSet.add(stepId);
      return newSet;
    });
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete({
        completedSteps: Array.from(completedSteps),
        completedAt: new Date().toISOString(),
        elapsedSeconds: elapsedTime,
      });
      onOpenChange(false);
    } finally {
      setIsCompleting(false);
    }
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

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => !isStarting && !isCompleting && onOpenChange(value)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{job.name}</DialogTitle>
          <DialogDescription>
            {job.processType && <span className="capitalize">{job.processType}</span>}
            {job.location && ` · ${job.location}`}
            {job.machine && ` · ${job.machine}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="wizard" disabled={!isJobStarted}>
              Wizard {isJobStarted && `(${Math.round(progress)}%)`}
            </TabsTrigger>
            <TabsTrigger value="edit" disabled={!canEdit}>
              Edit
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto space-y-4 mt-4">
            {/* Job Summary */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
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
                  {isJobStarted && (
                    <div className="flex items-center gap-1 text-sm font-mono">
                      <Clock className="h-4 w-4" />
                      {formatTime(elapsedTime)}
                    </div>
                  )}
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
                        onValueChange={handleAssign}
                        disabled={isAssigning}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff member..." />
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
                )}
              </CardContent>
            </Card>

            {/* Start Button (if not started) */}
            {!isJobStarted && job.status !== "completed" && (
              <Alert>
                <Play className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Ready to start this job? Time tracking will begin automatically.</span>
                  <Button size="sm" onClick={handleStart} disabled={isStarting}>
                    {isStarting ? "Starting..." : "Start Job"}
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

          {/* Wizard Tab */}
          <TabsContent value="wizard" className="flex-1 overflow-y-auto space-y-4 mt-4">
            {/* Progress */}
            {isJobStarted && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Progress</span>
                  <span className="text-muted-foreground">
                    {completedSteps.size} of {steps.length} steps
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Time Elapsed */}
            {isJobStarted && (
              <div className="flex items-center justify-center gap-2 py-2 bg-muted/50 rounded-lg">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-mono">{formatTime(elapsedTime)}</span>
              </div>
            )}

            {/* Wizard Steps */}
            {isJobStarted && (
              <div className="space-y-2">
                {steps.map((step, index) => {
                  const isCompleted = completedSteps.has(step.id);
                  const isCurrent = index === currentStep && !isCompleted;
                  const isLocked = index > currentStep && !isCompleted;

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-all",
                        isCompleted && "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
                        isCurrent && "bg-primary/5 border-primary/50",
                        isLocked && "opacity-50"
                      )}
                    >
                      <div className="mt-0.5">
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Circle
                            className={cn(
                              "h-5 w-5",
                              isCurrent ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{step.title}</div>
                        <div className="text-sm text-muted-foreground">{step.description}</div>
                      </div>
                      {isCurrent && !isCompleted && (
                        <Button size="sm" onClick={() => handleStepComplete(step.id)}>
                          Complete
                          <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Edit Tab */}
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
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isJobStarted && allStepsComplete && (
            <Button onClick={handleComplete} disabled={isCompleting}>
              {isCompleting ? "Completing..." : "Complete Job"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
