'use client';

import * as React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Package,
  AlertTriangle,
  Link2,
  Import,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { ModulePageHeader } from '@/ui/templates';
import { GuidePlanDialog } from '@/components/planning/GuidePlanDialog';
import { BatchPlanDialog } from '@/components/planning/BatchPlanDialog';
import { CreateBatchesFromPlanDialog } from '@/components/planning/CreateBatchesFromPlanDialog';
import { LinkBatchesDialog } from '@/components/planning/LinkBatchesDialog';
import { ImportBatchesToGuidePlanDialog } from '@/components/planning/ImportBatchesToGuidePlanDialog';
import { fetchJson } from '@/lib/http/fetchJson';
import { SWR_KEYS, onGuidePlanChange, onBatchPlanChange, onBatchChange } from '@/lib/swr/keys';
import { formatWeekRange, formatWeekYear } from '@/lib/planning/guide-plan-types';
import type {
  GuidePlanWithProgress,
  BatchPlanWithProgress,
} from '@/lib/planning/guide-plan-types';
import { useToast } from '@/hooks/use-toast';

type GuidePlanDetailResponse = {
  guidePlan: GuidePlanWithProgress;
  batchPlans: BatchPlanWithProgress[];
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

type Props = {
  guidePlanId: string;
};

export function GuidePlanDetailClient({ guidePlanId }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [batchPlanDialogOpen, setBatchPlanDialogOpen] = React.useState(false);
  const [createBatchesDialogOpen, setCreateBatchesDialogOpen] = React.useState(false);
  const [editingBatchPlan, setEditingBatchPlan] = React.useState<BatchPlanWithProgress | null>(null);
  const [selectedBatchPlan, setSelectedBatchPlan] = React.useState<BatchPlanWithProgress | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletingBatchPlan, setDeletingBatchPlan] = React.useState<BatchPlanWithProgress | null>(null);
  const [deleteGuidePlanDialogOpen, setDeleteGuidePlanDialogOpen] = React.useState(false);
  const [linkBatchesDialogOpen, setLinkBatchesDialogOpen] = React.useState(false);
  const [linkingBatchPlan, setLinkingBatchPlan] = React.useState<BatchPlanWithProgress | null>(null);
  const [importBatchesDialogOpen, setImportBatchesDialogOpen] = React.useState(false);

  const { data, isLoading, mutate } = useSWR<GuidePlanDetailResponse>(
    SWR_KEYS.guidePlan(guidePlanId),
    (url: string) => fetchJson<GuidePlanDetailResponse>(url),
    { revalidateOnFocus: false }
  );

  const guidePlan = data?.guidePlan;
  const batchPlans = data?.batchPlans ?? [];

  const handleEditSuccess = () => {
    mutate();
    onGuidePlanChange();
    setEditDialogOpen(false);
  };

  const handleBatchPlanSuccess = () => {
    mutate();
    onBatchPlanChange();
    setBatchPlanDialogOpen(false);
    setEditingBatchPlan(null);
  };

  const handleCreateBatchesSuccess = () => {
    mutate();
    onBatchChange();
    onBatchPlanChange();
    setCreateBatchesDialogOpen(false);
    setSelectedBatchPlan(null);
  };

  const handleEditBatchPlan = (bp: BatchPlanWithProgress) => {
    setEditingBatchPlan(bp);
    setBatchPlanDialogOpen(true);
  };

  const handleCloseBatchPlanDialog = () => {
    setBatchPlanDialogOpen(false);
    setEditingBatchPlan(null);
  };

  const handleCreateBatches = (bp: BatchPlanWithProgress) => {
    setSelectedBatchPlan(bp);
    setCreateBatchesDialogOpen(true);
  };

  const handleLinkBatches = (bp: BatchPlanWithProgress) => {
    setLinkingBatchPlan(bp);
    setLinkBatchesDialogOpen(true);
  };

  const handleLinkBatchesSuccess = () => {
    mutate();
    onBatchPlanChange();
  };

  const handleImportBatchesSuccess = () => {
    mutate();
    onGuidePlanChange();
    onBatchPlanChange();
    onBatchChange();
    setImportBatchesDialogOpen(false);
  };

  const handleDeleteBatchPlan = async () => {
    if (!deletingBatchPlan) return;
    try {
      await fetchJson(`/api/production/batch-plans/${deletingBatchPlan.id}`, {
        method: 'DELETE',
      });
      toast({ title: 'Batch plan deleted' });
      mutate();
      onBatchPlanChange();
    } catch (error: any) {
      toast({
        title: 'Failed to delete batch plan',
        description: error?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingBatchPlan(null);
    }
  };

  const handleDeleteGuidePlan = async () => {
    try {
      await fetchJson(`/api/production/guide-plans/${guidePlanId}`, {
        method: 'DELETE',
      });
      toast({ title: 'Guide plan deleted' });
      onGuidePlanChange();
      router.push('/production/planning/guide-plans');
    } catch (error: any) {
      toast({
        title: 'Failed to delete guide plan',
        description: error?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeleteGuidePlanDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading guide plan...</p>
      </div>
    );
  }

  if (!guidePlan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Guide plan not found</p>
        <Link href="/production/planning/guide-plans">
          <Button variant="outline">Back to Guide Plans</Button>
        </Link>
      </div>
    );
  }

  const remainingToAllocate = guidePlan.targetQuantity - guidePlan.progress.totalPlanned;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/production/planning/guide-plans">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <ModulePageHeader
            title={guidePlan.name}
            description={`${guidePlan.targetFamily}${guidePlan.targetSizeName ? ` · ${guidePlan.targetSizeName}` : ''}`}
            actionsSlot={
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setImportBatchesDialogOpen(true)}>
                  <Import className="mr-1.5 h-4 w-4" />
                  Import Batches
                </Button>
                <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                  <Edit className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
                <Button onClick={() => setBatchPlanDialogOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Batch Plan
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteGuidePlanDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Guide Plan
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
              <CardTitle>
                <Badge className={statusColors[guidePlan.status] ?? 'bg-gray-100'}>
                  {guidePlan.status}
                </Badge>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Target</CardDescription>
              <CardTitle className="text-2xl">
                {guidePlan.targetQuantity.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Planned</CardDescription>
              <CardTitle className="text-2xl">
                {guidePlan.progress.totalPlanned.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Batches</CardDescription>
              <CardTitle className="text-2xl">
                {guidePlan.progress.totalInBatches.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-2xl">
                {guidePlan.progress.totalCompleted.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>
              Ready{' '}
              {formatWeekRange(
                guidePlan.readyFromWeek,
                guidePlan.readyFromYear,
                guidePlan.readyToWeek,
                guidePlan.readyToYear
              )}
              {guidePlan.protocolName && ` · Recipe: ${guidePlan.protocolName}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24 shrink-0">Planned</span>
              <Progress value={guidePlan.progress.percentPlanned} className="h-3 flex-1" />
              <span className="text-sm w-24 text-right">
                {guidePlan.progress.totalPlanned.toLocaleString()} ({guidePlan.progress.percentPlanned}%)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24 shrink-0">In batches</span>
              <Progress value={guidePlan.progress.percentInBatches} className="h-3 flex-1" />
              <span className="text-sm w-24 text-right">
                {guidePlan.progress.totalInBatches.toLocaleString()} ({guidePlan.progress.percentInBatches}%)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24 shrink-0">Complete</span>
              <Progress value={guidePlan.progress.percentComplete} className="h-3 flex-1" />
              <span className="text-sm w-24 text-right">
                {guidePlan.progress.totalCompleted.toLocaleString()} ({guidePlan.progress.percentComplete}%)
              </span>
            </div>
            {remainingToAllocate > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {remainingToAllocate.toLocaleString()} remaining to allocate in batch plans
              </p>
            )}
          </CardContent>
        </Card>

        {/* Batch Plans Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Batch Plans</CardTitle>
                <CardDescription>
                  Variety-level breakdown of the production target
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setBatchPlanDialogOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Batch Plan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {batchPlans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No batch plans yet. Add variety-level plans to break down this target.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variety</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">In Batches</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchPlans.map((bp) => (
                    <TableRow key={bp.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{bp.plantVarietyName ?? 'Unknown'}</p>
                          {bp.plantVarietyFamily && (
                            <p className="text-xs text-muted-foreground">
                              {bp.plantVarietyFamily}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{bp.targetSizeName ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        {bp.plannedQuantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {bp.progress.totalInBatches.toLocaleString()}
                        {bp.progress.batchCount > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({bp.progress.batchCount})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress
                            value={bp.progress.percentInBatches}
                            className="h-2"
                          />
                          <span className="text-xs text-muted-foreground">
                            {bp.progress.percentInBatches}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[bp.status] ?? 'bg-gray-100'}>
                          {bp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCreateBatches(bp)}>
                              <Package className="mr-2 h-4 w-4" />
                              Create Batches
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLinkBatches(bp)}>
                              <Link2 className="mr-2 h-4 w-4" />
                              Link Existing Batches
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditBatchPlan(bp)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setDeletingBatchPlan(bp);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {guidePlan.description && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {guidePlan.description}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <GuidePlanDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        guidePlan={guidePlan}
        onSuccess={handleEditSuccess}
      />

      <BatchPlanDialog
        open={batchPlanDialogOpen}
        onOpenChange={handleCloseBatchPlanDialog}
        guidePlan={guidePlan}
        batchPlan={editingBatchPlan}
        onSuccess={handleBatchPlanSuccess}
      />

      {selectedBatchPlan && (
        <CreateBatchesFromPlanDialog
          open={createBatchesDialogOpen}
          onOpenChange={(open) => {
            setCreateBatchesDialogOpen(open);
            if (!open) setSelectedBatchPlan(null);
          }}
          batchPlan={selectedBatchPlan}
          onSuccess={handleCreateBatchesSuccess}
        />
      )}

      {linkingBatchPlan && (
        <LinkBatchesDialog
          open={linkBatchesDialogOpen}
          onOpenChange={(open) => {
            setLinkBatchesDialogOpen(open);
            if (!open) setLinkingBatchPlan(null);
          }}
          batchPlan={linkingBatchPlan}
          onSuccess={handleLinkBatchesSuccess}
        />
      )}

      <ImportBatchesToGuidePlanDialog
        open={importBatchesDialogOpen}
        onOpenChange={setImportBatchesDialogOpen}
        guidePlan={guidePlan}
        onSuccess={handleImportBatchesSuccess}
      />

      {/* Delete Batch Plan Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this batch plan for{' '}
              {deletingBatchPlan?.plantVarietyName}? This action cannot be undone.
              {(deletingBatchPlan?.progress.batchCount ?? 0) > 0 && (
                <span className="block mt-2 text-amber-600">
                  Note: {deletingBatchPlan?.progress.batchCount} batches are linked to this plan.
                  They will not be deleted but will lose their plan reference.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBatchPlan}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Guide Plan Dialog */}
      <AlertDialog
        open={deleteGuidePlanDialogOpen}
        onOpenChange={setDeleteGuidePlanDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Guide Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{guidePlan.name}"? This will also delete all
              associated batch plans. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGuidePlan}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
