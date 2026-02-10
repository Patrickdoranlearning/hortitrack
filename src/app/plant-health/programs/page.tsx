'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Calendar,
  Repeat,
  FlaskConical,
  MapPin,
  Leaf,
  Clock,
  Pencil,
  Bug,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { ProgramWizard } from '@/components/plant-health/ipm/ProgramWizard';
import { RemedialProgramWizard } from '@/components/plant-health/ipm/RemedialProgramWizard';
import {
  listIpmPrograms,
  listIpmAssignments,
  deleteIpmProgram,
  deactivateIpmAssignment,
  createIpmAssignment,
  getPlantFamilies,
  listLocations,
  type IpmProgram,
  type IpmAssignment,
} from '@/app/actions/ipm';
import {
  listRemedialPrograms,
  deleteRemedialProgram,
} from '@/app/actions/ipm-remedial';
import type { IpmRemedialProgram } from '@/types/ipm-remedial';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/ui/error-boundary';

type Location = { id: string; name: string };

export default function IpmProgramsPage() {
  // Preventative programs state
  const [programs, setPrograms] = useState<IpmProgram[]>([]);
  const [assignments, setAssignments] = useState<IpmAssignment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<IpmProgram | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<IpmProgram | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [programToAssign, setProgramToAssign] = useState<IpmProgram | null>(null);
  const [assignTargetType, setAssignTargetType] = useState<'family' | 'location'>('family');
  const [assignTarget, setAssignTarget] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Remedial programs state
  const [remedialPrograms, setRemedialPrograms] = useState<IpmRemedialProgram[]>([]);
  const [loadingRemedial, setLoadingRemedial] = useState(true);
  const [remedialWizardOpen, setRemedialWizardOpen] = useState(false);
  const [editingRemedialProgram, setEditingRemedialProgram] = useState<IpmRemedialProgram | null>(null);
  const [deleteRemedialDialogOpen, setDeleteRemedialDialogOpen] = useState(false);
  const [remedialProgramToDelete, setRemedialProgramToDelete] = useState<IpmRemedialProgram | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<string>('preventative');

  const handleEdit = (program: IpmProgram) => {
    setEditingProgram(program);
    setWizardOpen(true);
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
    setEditingProgram(null);
  };

  const handleRemedialEdit = (program: IpmRemedialProgram) => {
    setEditingRemedialProgram(program);
    setRemedialWizardOpen(true);
  };

  const handleRemedialWizardClose = () => {
    setRemedialWizardOpen(false);
    setEditingRemedialProgram(null);
  };

  const handleAddAssignment = (program: IpmProgram) => {
    setProgramToAssign(program);
    setAssignTargetType('family');
    setAssignTarget('');
    setAssignDialogOpen(true);
  };

  const submitAssignment = async () => {
    if (!programToAssign || !assignTarget) return;

    setIsAssigning(true);
    const result = await createIpmAssignment({
      programId: programToAssign.id,
      targetType: assignTargetType,
      targetFamily: assignTargetType === 'family' ? assignTarget : undefined,
      targetLocationId: assignTargetType === 'location' ? assignTarget : undefined,
    });

    if (result.success) {
      toast.success('Assignment created!');
      fetchData();
      setAssignDialogOpen(false);
    } else {
      toast.error(result.error || 'Failed to create assignment');
    }
    setIsAssigning(false);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [programsResult, assignmentsResult, locationsResult, familiesResult] = await Promise.all([
      listIpmPrograms(),
      listIpmAssignments(),
      listLocations(),
      getPlantFamilies(),
    ]);

    if (programsResult.success && programsResult.data) {
      setPrograms(programsResult.data);
    }
    if (assignmentsResult.success && assignmentsResult.data) {
      setAssignments(assignmentsResult.data);
    }
    if (locationsResult.success && locationsResult.data) {
      setLocations(locationsResult.data.map((l) => ({ id: l.id, name: l.name })));
    }
    if (familiesResult.success && familiesResult.data) {
      setFamilies(familiesResult.data);
    }
    setLoading(false);
  }, []);

  const fetchRemedialData = useCallback(async () => {
    setLoadingRemedial(true);
    const result = await listRemedialPrograms();
    if (result.success && result.data) {
      setRemedialPrograms(result.data);
    }
    setLoadingRemedial(false);
  }, []);

  useEffect(() => {
    fetchData();
    fetchRemedialData();
  }, [fetchData, fetchRemedialData]);

  const handleDelete = async () => {
    if (!programToDelete) return;
    const result = await deleteIpmProgram(programToDelete.id);
    if (result.success) {
      toast.success('Program deleted');
      fetchData();
    } else {
      toast.error(result.error || 'Failed to delete program');
    }
    setProgramToDelete(null);
    setDeleteDialogOpen(false);
  };

  const confirmDelete = (program: IpmProgram) => {
    setProgramToDelete(program);
    setDeleteDialogOpen(true);
  };

  const handleRemedialDelete = async () => {
    if (!remedialProgramToDelete) return;
    const result = await deleteRemedialProgram(remedialProgramToDelete.id);
    if (result.success) {
      toast.success('Remedial program deleted');
      fetchRemedialData();
    } else {
      toast.error(result.error || 'Failed to delete program');
    }
    setRemedialProgramToDelete(null);
    setDeleteRemedialDialogOpen(false);
  };

  const confirmRemedialDelete = (program: IpmRemedialProgram) => {
    setRemedialProgramToDelete(program);
    setDeleteRemedialDialogOpen(true);
  };

  const handleDeactivateAssignment = async (assignment: IpmAssignment) => {
    const result = await deactivateIpmAssignment(assignment.id);
    if (result.success) {
      toast.success('Assignment deactivated');
      fetchData();
    } else {
      toast.error(result.error || 'Failed to deactivate assignment');
    }
  };

  const getAssignmentsForProgram = (programId: string) =>
    assignments.filter((a) => a.programId === programId && a.isActive);

  // Group remedial programs by pest/disease
  const remedialByPest = remedialPrograms.reduce((acc, program) => {
    const pest = program.targetPestDisease;
    if (!acc[pest]) {
      acc[pest] = [];
    }
    acc[pest].push(program);
    return acc;
  }, {} as Record<string, IpmRemedialProgram[]>);

  return (
    <PageFrame moduleKey="plantHealth">
      <ErrorBoundary>
      <div className="space-y-6">
        <ModulePageHeader
          title="IPM Programs"
          description="Manage preventative and remedial treatment programs"
          actionsSlot={
            activeTab === 'preventative' ? (
              <Button onClick={() => setWizardOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Preventative Program
              </Button>
            ) : (
              <Button onClick={() => setRemedialWizardOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Remedial Program
              </Button>
            )
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="preventative" className="gap-2">
              <Calendar className="h-4 w-4" />
              Preventative
            </TabsTrigger>
            <TabsTrigger value="remedial" className="gap-2">
              <Bug className="h-4 w-4" />
              Remedial
            </TabsTrigger>
          </TabsList>

          {/* Preventative Programs Tab */}
          <TabsContent value="preventative" className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading programs...</div>
            ) : programs.length === 0 ? (
              <Card className="p-12 text-center">
                <Repeat className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-lg text-muted-foreground">No preventative programs yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a program to schedule recurring treatments for plant families or locations.
                </p>
                <Button className="mt-6" onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Program
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {programs.map((program) => {
                  const programAssignments = getAssignmentsForProgram(program.id);
                  const totalApplications = Math.ceil(
                    (program.durationWeeks * 7) / program.intervalDays
                  );

                  return (
                    <Card key={program.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {program.name}
                              {!program.isActive && (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </CardTitle>
                            {program.description && (
                              <CardDescription className="mt-1">
                                {program.description}
                              </CardDescription>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(program)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Program
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => confirmDelete(program)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Program
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Schedule Info */}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Every {program.intervalDays} days
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Calendar className="h-3 w-3" />
                            {program.durationWeeks} weeks
                          </Badge>
                          <Badge variant="secondary">
                            ~{totalApplications} applications
                          </Badge>
                        </div>

                        {/* Products */}
                        {program.steps && program.steps.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Products ({program.steps.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {program.steps.map((step, i) => (
                                <Badge key={step.id} variant="outline" className="text-xs gap-1">
                                  <FlaskConical className="h-3 w-3" />
                                  {step.product?.name || `Product ${i + 1}`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Assignments */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              Active Assignments ({programAssignments.length})
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleAddAssignment(program)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                          {programAssignments.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Not assigned yet - click Add to assign to a family</p>
                          ) : (
                            <div className="space-y-1">
                              {programAssignments.slice(0, 3).map((assignment) => (
                                <div
                                  key={assignment.id}
                                  className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1"
                                >
                                  <div className="flex items-center gap-2">
                                    {assignment.targetType === 'family' ? (
                                      <>
                                        <Leaf className="h-3 w-3 text-green-600" />
                                        <span>{assignment.targetFamily}</span>
                                      </>
                                    ) : (
                                      <>
                                        <MapPin className="h-3 w-3 text-blue-600" />
                                        <span>{assignment.location?.name}</span>
                                      </>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeactivateAssignment(assignment)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                              {programAssignments.length > 3 && (
                                <p className="text-xs text-muted-foreground">
                                  +{programAssignments.length - 3} more
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Remedial Programs Tab */}
          <TabsContent value="remedial" className="space-y-4">
            {loadingRemedial ? (
              <div className="text-center py-12 text-muted-foreground">Loading remedial programs...</div>
            ) : remedialPrograms.length === 0 ? (
              <Card className="p-12 text-center">
                <Bug className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-lg text-muted-foreground">No remedial programs yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create protocols for treating specific pests and diseases when found during scouting.
                </p>
                <Button className="mt-6" onClick={() => setRemedialWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Remedial Program
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(remedialByPest).map(([pest, pestPrograms]) => (
                  <div key={pest}>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {pest}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {pestPrograms.map((program) => (
                        <Card key={program.id}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="flex items-center gap-2 text-base">
                                  {program.name}
                                  {program.treatmentUrgency === 'immediate' && (
                                    <Badge variant="destructive" className="gap-1">
                                      <Zap className="h-3 w-3" />
                                      Immediate
                                    </Badge>
                                  )}
                                </CardTitle>
                                {program.description && (
                                  <CardDescription className="mt-1">
                                    {program.description}
                                  </CardDescription>
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleRemedialEdit(program)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit Program
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => confirmRemedialDelete(program)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Program
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* Severity + Duration */}
                            <div className="flex flex-wrap gap-2">
                              {program.severityApplicability.map((sev) => (
                                <Badge
                                  key={sev}
                                  className={
                                    sev === 'critical'
                                      ? 'bg-red-100 text-red-800'
                                      : sev === 'medium'
                                        ? 'bg-orange-100 text-orange-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                  }
                                >
                                  {sev}
                                </Badge>
                              ))}
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                {program.treatmentDurationDays} days
                              </Badge>
                            </div>

                            {/* Steps */}
                            {program.steps && program.steps.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Treatment Steps ({program.steps.length})
                                </p>
                                <div className="space-y-1">
                                  {program.steps.slice(0, 3).map((step) => (
                                    <div
                                      key={step.id}
                                      className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1"
                                    >
                                      <Badge variant="outline" className="text-[10px] min-w-[50px] justify-center">
                                        Day {step.dayOffset}
                                      </Badge>
                                      <span className="truncate">
                                        {step.product?.name || 'Unknown'}
                                      </span>
                                    </div>
                                  ))}
                                  {program.steps.length > 3 && (
                                    <p className="text-xs text-muted-foreground pl-2">
                                      +{program.steps.length - 3} more steps
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Products summary */}
                            {program.productNames && program.productNames.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {program.productNames.map((name) => (
                                  <Badge key={name} variant="outline" className="text-xs gap-1">
                                    <FlaskConical className="h-3 w-3" />
                                    {name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Preventative Program Wizard */}
        <ProgramWizard
          open={wizardOpen}
          onOpenChange={handleWizardClose}
          locations={locations}
          families={families}
          editingProgram={editingProgram}
          onSuccess={() => {
            fetchData();
            handleWizardClose();
          }}
        />

        {/* Remedial Program Wizard */}
        <RemedialProgramWizard
          open={remedialWizardOpen}
          onOpenChange={handleRemedialWizardClose}
          editingProgram={editingRemedialProgram}
          onSuccess={() => {
            fetchRemedialData();
            handleRemedialWizardClose();
          }}
        />

        {/* Delete Preventative Program Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Program</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &ldquo;{programToDelete?.name}&rdquo;? This will also remove all
                assignments. This action cannot be undone.
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

        {/* Delete Remedial Program Confirmation */}
        <AlertDialog open={deleteRemedialDialogOpen} onOpenChange={setDeleteRemedialDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Remedial Program</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &ldquo;{remedialProgramToDelete?.name}&rdquo;?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemedialDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Assignment Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Add Assignment</DialogTitle>
              <DialogDescription>
                Assign &ldquo;{programToAssign?.name}&rdquo; to a plant family or location.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Target Type</Label>
                <Select
                  value={assignTargetType}
                  onValueChange={(v) => {
                    setAssignTargetType(v as 'family' | 'location');
                    setAssignTarget('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Plant Family</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{assignTargetType === 'family' ? 'Family' : 'Location'}</Label>
                <Select value={assignTarget} onValueChange={setAssignTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${assignTargetType}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignTargetType === 'family'
                      ? families.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))
                      : locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitAssignment} disabled={!assignTarget || isAssigning}>
                {isAssigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Assignment'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </ErrorBoundary>
    </PageFrame>
  );
}
