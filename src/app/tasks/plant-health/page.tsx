'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Loader2,
  Beaker,
  Package,
  AlertTriangle,
  ChevronRight,
  FlaskConical,
  Leaf,
  SkipForward,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import {
  getGroupedTasks,
  completeTasks,
  skipTask,
  markOverdueTasks,
  type TaskGroup,
  type IpmTask,
  type ComplianceData,
} from '@/app/actions/ipm-tasks';
import { getAvailableBottles, type IpmBottle } from '@/app/actions/ipm-stock';
import { cn } from '@/lib/utils';
import { useAttributeOptions } from '@/hooks/useAttributeOptions';

export const dynamic = 'force-dynamic';

export default function PlantHealthTasksPage() {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>('pending');
  const [selectedGroup, setSelectedGroup] = useState<TaskGroup | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [taskToSkip, setTaskToSkip] = useState<IpmTask | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [bottles, setBottles] = useState<IpmBottle[]>([]);
  const [selectedBottle, setSelectedBottle] = useState<string>('');
  const [quantityUsed, setQuantityUsed] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Compliance fields
  const [reasonForUse, setReasonForUse] = useState('');
  const [weatherConditions, setWeatherConditions] = useState('');
  const [areaTreated, setAreaTreated] = useState('');
  const [sprayerUsed, setSprayerUsed] = useState('');
  const [signedBy, setSignedBy] = useState('');
  
  // Wizard state
  const [wizardStep, setWizardStep] = useState(1);
  
  // Sprayer options from dropdown manager
  const { options: sprayerOptions } = useAttributeOptions('sprayer_used');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    
    // Mark overdue tasks first
    await markOverdueTasks();
    
    const result = await getGroupedTasks({
      status: tab as 'pending' | 'completed' | 'skipped' | 'overdue',
    });
    
    if (result.success && result.data) {
      setGroups(result.data);
    } else {
      toast.error('Failed to load tasks');
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleGroupClick = async (group: TaskGroup) => {
    setSelectedGroup(group);
    setSelectedTaskIds(new Set(group.tasks.map(t => t.id)));
    
    // Load available bottles for this product
    const bottlesResult = await getAvailableBottles(group.productId);
    if (bottlesResult.success && bottlesResult.data) {
      setBottles(bottlesResult.data);
    }
  };

  const handleCompleteGroup = async () => {
    if (selectedTaskIds.size === 0) return;
    
    setIsSubmitting(true);
    const bottleIdToUse = selectedBottle && selectedBottle !== 'none' ? selectedBottle : undefined;
    
    // Get crop name from first batch
    const firstTask = selectedGroup?.tasks[0];
    const cropName = firstTask?.batch?.variety || 'Unknown crop';
    
    // Calculate safe harvest date based on product's WHI
    const harvestInterval = selectedGroup?.tasks[0]?.product?.whiDays;
    const safeHarvestDate = harvestInterval 
      ? new Date(Date.now() + harvestInterval * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined;

    const result = await completeTasks(Array.from(selectedTaskIds), {
      bottleId: bottleIdToUse,
      quantityUsedMl: quantityUsed ? parseInt(quantityUsed) : undefined,
      notes: notes || undefined,
      pcsNumber: selectedGroup?.tasks[0]?.product?.pcsNumber || undefined,
      cropName,
      reasonForUse: reasonForUse || undefined,
      weatherConditions: weatherConditions || undefined,
      harvestIntervalDays: harvestInterval,
      safeHarvestDate,
      areaTreated: areaTreated || undefined,
      sprayerUsed: sprayerUsed || undefined,
      signedBy: signedBy || undefined,
    });

    if (result.success) {
      toast.success(`${selectedTaskIds.size} task(s) completed & logged to batch history!`);
      setCompleteDialogOpen(false);
      setSelectedGroup(null);
      setSelectedTaskIds(new Set());
      resetComplianceFields();
      fetchTasks();
    } else {
      toast.error(result.error || 'Failed to complete tasks');
    }
    setIsSubmitting(false);
  };

  const resetComplianceFields = () => {
    setSelectedBottle('');
    setQuantityUsed('');
    setNotes('');
    setReasonForUse('');
    setWeatherConditions('');
    setAreaTreated('');
    setSprayerUsed('');
    setSignedBy('');
    setWizardStep(1);
  };

  const handleSkipTask = async () => {
    if (!taskToSkip || !skipReason) return;
    
    setIsSubmitting(true);
    const result = await skipTask(taskToSkip.id, skipReason);
    
    if (result.success) {
      toast.success('Task skipped');
      setSkipDialogOpen(false);
      setTaskToSkip(null);
      setSkipReason('');
      fetchTasks();
    } else {
      toast.error(result.error || 'Failed to skip task');
    }
    setIsSubmitting(false);
  };

  const toggleTask = (taskId: string) => {
    const newSet = new Set(selectedTaskIds);
    if (newSet.has(taskId)) {
      newSet.delete(taskId);
    } else {
      newSet.add(taskId);
    }
    setSelectedTaskIds(newSet);
  };

  const getWeekLabel = (calendarWeek: number, weekStartDate: string) => {
    const today = new Date();
    const weekStart = new Date(weekStartDate);
    const diffDays = Math.floor((weekStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < -7) return `Week ${calendarWeek} (${Math.abs(Math.floor(diffDays / 7))} weeks ago)`;
    if (diffDays < 0) return `Week ${calendarWeek} (This week - overdue)`;
    if (diffDays < 7) return `Week ${calendarWeek} (This week)`;
    if (diffDays < 14) return `Week ${calendarWeek} (Next week)`;
    return `Week ${calendarWeek} (in ${Math.floor(diffDays / 7)} weeks)`;
  };

  // Group by calendar week for display
  const groupsByWeek = groups.reduce((acc, group) => {
    const weekKey = group.calendarWeek;
    if (!acc[weekKey]) {
      acc[weekKey] = {
        calendarWeek: group.calendarWeek,
        weekStartDate: group.weekStartDate,
        groups: [],
      };
    }
    acc[weekKey].groups.push(group);
    return acc;
  }, {} as Record<number, { calendarWeek: number; weekStartDate: string; groups: TaskGroup[] }>);

  // Sort by actual date, not calendar week number (handles year boundaries correctly)
  const sortedWeeks = Object.values(groupsByWeek).sort((a, b) => 
    new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime()
  );

  return (
    <PageFrame moduleKey="tasks">
      <div className="space-y-6">
        <ModulePageHeader
          title="Plant Health Tasks"
          description="IPM spray schedules grouped by product and week"
          actionsSlot={
            <Link href="/tasks">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Overview
              </Button>
            </Link>
          }
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending
            </TabsTrigger>
            <TabsTrigger value="overdue" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </TabsTrigger>
            <TabsTrigger value="skipped" className="gap-2">
              <SkipForward className="h-4 w-4" />
              Skipped
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-6">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Loading tasks...</p>
              </div>
            ) : sortedWeeks.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="h-16 w-16 mx-auto text-muted-foreground/30" />
                <p className="mt-4 text-lg text-muted-foreground">
                  No {tab} tasks
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tasks are generated when batches are potted with IPM programs assigned.
                </p>
                <Link href="/plant-health">
                  <Button variant="outline" className="mt-4">
                    Go to Plant Health
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-8">
                {sortedWeeks.map((week) => (
                  <div key={week.calendarWeek}>
                    <div className="flex items-center gap-3 mb-4">
                      <Calendar className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold">
                        {getWeekLabel(week.calendarWeek, week.weekStartDate)}
                      </h2>
                      <Badge variant="outline" className="ml-auto">
                        {week.groups.reduce((sum, g) => sum + g.totalBatches, 0)} batches
                      </Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {week.groups.map((group, idx) => (
                        <Card
                          key={idx}
                          className={cn(
                            'cursor-pointer transition-all hover:shadow-md',
                            tab === 'overdue' && 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'
                          )}
                          onClick={() => handleGroupClick(group)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {group.isTankMix ? (
                                  <Beaker className="h-5 w-5 text-purple-600" />
                                ) : (
                                  <FlaskConical className="h-5 w-5 text-primary" />
                                )}
                                <div>
                                  <CardTitle className="text-base">
                                    {group.isTankMix
                                      ? group.tankMixProducts?.join(' + ')
                                      : group.productName}
                                  </CardTitle>
                                  {group.method && (
                                    <p className="text-xs text-muted-foreground">
                                      {group.method}
                                      {group.rate && ` @ ${group.rate} ${group.rateUnit}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                {group.locations.length} location{group.locations.length !== 1 ? 's' : ''}
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Leaf className="h-4 w-4" />
                                {group.totalBatches} batch{group.totalBatches !== 1 ? 'es' : ''}
                              </div>
                            </div>
                            
                            {/* Location preview */}
                            <div className="mt-3 flex flex-wrap gap-1">
                              {group.locations.slice(0, 3).map((loc) => (
                                <Badge key={loc.id} variant="secondary" className="text-xs">
                                  {loc.name} ({loc.batchCount})
                                </Badge>
                              ))}
                              {group.locations.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{group.locations.length - 3} more
                                </Badge>
                              )}
                            </div>
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

        {/* Task Group Detail Dialog */}
        <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedGroup?.isTankMix ? (
                  <Beaker className="h-5 w-5 text-purple-600" />
                ) : (
                  <FlaskConical className="h-5 w-5 text-primary" />
                )}
                {selectedGroup?.isTankMix
                  ? selectedGroup?.tankMixProducts?.join(' + ')
                  : selectedGroup?.productName}
              </DialogTitle>
              <DialogDescription>
                {selectedGroup?.method}
                {selectedGroup?.rate && ` @ ${selectedGroup.rate} ${selectedGroup.rateUnit}`}
                {' • '}Week {selectedGroup?.calendarWeek}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4">
              {/* Locations Summary */}
              <div className="mb-4">
                <h4 className="font-medium mb-2">Locations to Spray:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedGroup?.locations.map((loc) => (
                    <Badge key={loc.id} variant="outline" className="text-sm">
                      <MapPin className="h-3 w-3 mr-1" />
                      {loc.name} ({loc.batchCount} batches)
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Individual Tasks */}
              <div className="border rounded-lg">
                <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {selectedTaskIds.size} of {selectedGroup?.tasks.length} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedTaskIds.size === selectedGroup?.tasks.length) {
                        setSelectedTaskIds(new Set());
                      } else {
                        setSelectedTaskIds(new Set(selectedGroup?.tasks.map(t => t.id)));
                      }
                    }}
                  >
                    {selectedTaskIds.size === selectedGroup?.tasks.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {selectedGroup?.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={selectedTaskIds.has(task.id)}
                        onCheckedChange={() => toggleTask(task.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {task.batch?.batchNumber || 'Unknown Batch'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.batch?.variety} • {task.location?.name}
                        </p>
                      </div>
                      {tab === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTaskToSkip(task);
                            setSkipDialogOpen(true);
                          }}
                        >
                          <SkipForward className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedGroup(null)}>
                Cancel
              </Button>
              {tab === 'pending' && (
                <Button
                  onClick={() => setCompleteDialogOpen(true)}
                  disabled={selectedTaskIds.size === 0}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Complete {selectedTaskIds.size} Task{selectedTaskIds.size !== 1 ? 's' : ''}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Complete Tasks Wizard */}
        <Dialog open={completeDialogOpen} onOpenChange={(open) => {
          if (!open) setWizardStep(1);
          setCompleteDialogOpen(open);
        }}>
          <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {wizardStep === 1 && 'Step 1: Product & Stock'}
                {wizardStep === 2 && 'Step 2: Application Details'}
                {wizardStep === 3 && 'Step 3: Sign Off'}
              </DialogTitle>
              <DialogDescription>
                {wizardStep === 1 && 'Confirm product details and select bottle used'}
                {wizardStep === 2 && 'Record application conditions and equipment'}
                {wizardStep === 3 && 'Review and sign off on the application'}
              </DialogDescription>
            </DialogHeader>

            {/* Progress Indicator */}
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                    wizardStep === step
                      ? 'bg-primary text-primary-foreground'
                      : wizardStep > step
                      ? 'bg-green-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {wizardStep > step ? '✓' : step}
                </div>
              ))}
            </div>

            <div className="py-4">
              {/* Step 1: Product & Stock */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <h4 className="font-medium text-sm mb-3">Product Details</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Product:</span>
                      <span className="font-medium">{selectedGroup?.productName}</span>
                      {selectedGroup?.tasks[0]?.product?.pcsNumber && (
                        <>
                          <span className="text-muted-foreground">PCS #:</span>
                          <span>{selectedGroup.tasks[0].product.pcsNumber}</span>
                        </>
                      )}
                      <span className="text-muted-foreground">Rate:</span>
                      <span>{selectedGroup?.rate} {selectedGroup?.rateUnit}</span>
                      <span className="text-muted-foreground">Method:</span>
                      <span>{selectedGroup?.method || 'Not specified'}</span>
                      {selectedGroup?.tasks[0]?.product?.whiDays && (
                        <>
                          <span className="text-muted-foreground">Harvest Interval:</span>
                          <span>{selectedGroup.tasks[0].product.whiDays} days</span>
                        </>
                      )}
                      <span className="text-muted-foreground">Batches:</span>
                      <span>{selectedTaskIds.size}</span>
                      <span className="text-muted-foreground">Date:</span>
                      <span>{new Date().toLocaleDateString('en-IE')}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Bottle Used</Label>
                    <Select value={selectedBottle} onValueChange={setSelectedBottle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bottle..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not tracking stock</SelectItem>
                        {bottles.map((bottle) => (
                          <SelectItem key={bottle.id} value={bottle.id}>
                            {bottle.bottleCode} - {bottle.remainingMl}ml remaining
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedBottle && selectedBottle !== 'none' && (
                    <div className="space-y-2">
                      <Label>Volume Used (ml) *</Label>
                      <input
                        type="number"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="e.g., 500"
                        value={quantityUsed}
                        onChange={(e) => setQuantityUsed(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Application Details */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Reason for Application *</Label>
                    <input
                      type="text"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="e.g., Preventive schedule, Aphid infestation"
                      value={reasonForUse}
                      onChange={(e) => setReasonForUse(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Weather Conditions</Label>
                    <input
                      type="text"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="e.g., Dry, 15°C, Low wind"
                      value={weatherConditions}
                      onChange={(e) => setWeatherConditions(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Area Treated</Label>
                    <input
                      type="text"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="e.g., 500m², Full tunnel"
                      value={areaTreated}
                      onChange={(e) => setAreaTreated(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Sprayer Used</Label>
                    <Select value={sprayerUsed} onValueChange={setSprayerUsed}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sprayer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sprayerOptions.filter(o => o.isActive).map((sprayer) => (
                          <SelectItem key={sprayer.systemCode} value={sprayer.displayLabel}>
                            {sprayer.displayLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Step 3: Sign Off */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <h4 className="font-medium text-sm mb-3">Application Summary</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Product:</span>
                      <span>{selectedGroup?.productName}</span>
                      <span className="text-muted-foreground">Batches:</span>
                      <span>{selectedTaskIds.size}</span>
                      <span className="text-muted-foreground">Reason:</span>
                      <span>{reasonForUse || '-'}</span>
                      <span className="text-muted-foreground">Weather:</span>
                      <span>{weatherConditions || '-'}</span>
                      <span className="text-muted-foreground">Sprayer:</span>
                      <span>{sprayerUsed || '-'}</span>
                      {selectedBottle && selectedBottle !== 'none' && (
                        <>
                          <span className="text-muted-foreground">Bottle:</span>
                          <span>{bottles.find(b => b.id === selectedBottle)?.bottleCode}</span>
                          <span className="text-muted-foreground">Volume:</span>
                          <span>{quantityUsed}ml</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Signed By *</Label>
                    <input
                      type="text"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Your name"
                      value={signedBy}
                      onChange={(e) => setSignedBy(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Additional Notes</Label>
                    <Textarea
                      placeholder="Any additional observations..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              {wizardStep > 1 && (
                <Button variant="outline" onClick={() => setWizardStep(wizardStep - 1)}>
                  Back
                </Button>
              )}
              {wizardStep === 1 && (
                <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
                  Cancel
                </Button>
              )}
              {wizardStep < 3 ? (
                <Button 
                  onClick={() => setWizardStep(wizardStep + 1)}
                  disabled={wizardStep === 2 && !reasonForUse}
                >
                  Next
                </Button>
              ) : (
                <Button 
                  onClick={handleCompleteGroup} 
                  disabled={isSubmitting || !signedBy || !reasonForUse}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete & Log
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Skip Task Dialog */}
        <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Skip Task</DialogTitle>
              <DialogDescription>
                Why is this task being skipped?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Textarea
                  placeholder="e.g., Batch sold, Weather conditions, Product unavailable..."
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSkipDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSkipTask}
                disabled={!skipReason || isSubmitting}
                variant="secondary"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Skipping...
                  </>
                ) : (
                  'Skip Task'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageFrame>
  );
}
