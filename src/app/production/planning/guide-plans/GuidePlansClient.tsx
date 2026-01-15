'use client';

import * as React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Plus, ChevronRight, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModulePageHeader } from '@/ui/templates';
import { GuidePlanDialog } from '@/components/planning/GuidePlanDialog';
import { fetchJson } from '@/lib/http/fetchJson';
import { SWR_KEYS, onGuidePlanChange } from '@/lib/swr/keys';
import { formatWeekRange } from '@/lib/planning/guide-plan-types';
import type { GuidePlanWithProgress } from '@/lib/planning/guide-plan-types';

type GuidePlansResponse = {
  guidePlans: GuidePlanWithProgress[];
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function GuidePlansClient() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<GuidePlanWithProgress | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data, isLoading, mutate } = useSWR<GuidePlansResponse>(
    SWR_KEYS.GUIDE_PLANS,
    (url: string) => fetchJson<GuidePlansResponse>(url),
    { revalidateOnFocus: false }
  );

  const guidePlans = data?.guidePlans ?? [];

  // Filter guide plans
  const filteredPlans = React.useMemo(() => {
    return guidePlans.filter((plan) => {
      // Status filter
      if (statusFilter !== 'all' && plan.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          plan.name.toLowerCase().includes(query) ||
          plan.targetFamily.toLowerCase().includes(query) ||
          (plan.targetSizeName?.toLowerCase().includes(query) ?? false)
        );
      }
      return true;
    });
  }, [guidePlans, statusFilter, searchQuery]);

  const handleSuccess = () => {
    mutate();
    onGuidePlanChange();
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const handleEdit = (plan: GuidePlanWithProgress) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  return (
    <>
      <div className="space-y-6">
        <ModulePageHeader
          title="Guide Plans"
          description="High-level production targets for plant families and sizes."
          actionsSlot={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Guide Plan
            </Button>
          }
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, family, or size..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Plans</CardDescription>
              <CardTitle className="text-3xl">{guidePlans.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Plans</CardDescription>
              <CardTitle className="text-3xl">
                {guidePlans.filter((p) => p.status === 'active').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Target Quantity</CardDescription>
              <CardTitle className="text-3xl">
                {guidePlans
                  .filter((p) => p.status === 'active')
                  .reduce((sum, p) => sum + p.targetQuantity, 0)
                  .toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl">
                {guidePlans
                  .filter((p) => p.status === 'active')
                  .reduce((sum, p) => sum + p.progress.totalInBatches, 0)
                  .toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Guide Plans List */}
        <Card>
          <CardHeader>
            <CardTitle>Production Plans</CardTitle>
            <CardDescription>
              {filteredPlans.length} of {guidePlans.length} plans
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                Loading guide plans...
              </div>
            )}

            {!isLoading && filteredPlans.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {guidePlans.length === 0
                  ? 'No guide plans yet. Create your first production target.'
                  : 'No plans match your filters.'}
              </div>
            )}

            {filteredPlans.map((plan) => (
              <Link
                key={plan.id}
                href={`/production/planning/guide-plans/${plan.id}`}
                className="block"
              >
                <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{plan.name}</h3>
                        <Badge className={statusColors[plan.status] ?? 'bg-gray-100'}>
                          {plan.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {plan.targetFamily}
                        {plan.targetSizeName && ` · ${plan.targetSizeName}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ready{' '}
                        {formatWeekRange(
                          plan.readyFromWeek,
                          plan.readyFromYear,
                          plan.readyToWeek,
                          plan.readyToYear
                        )}
                        {plan.protocolName && ` · Recipe: ${plan.protocolName}`}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold">
                        {plan.targetQuantity.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">target</p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-2" />
                  </div>

                  {/* Progress bars */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 shrink-0">
                        Planned
                      </span>
                      <Progress value={plan.progress.percentPlanned} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {plan.progress.percentPlanned}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 shrink-0">
                        In batches
                      </span>
                      <Progress value={plan.progress.percentInBatches} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {plan.progress.percentInBatches}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 shrink-0">
                        Complete
                      </span>
                      <Progress value={plan.progress.percentComplete} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {plan.progress.percentComplete}%
                      </span>
                    </div>
                  </div>

                  {plan.batchPlanCount !== undefined && plan.batchPlanCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-3">
                      {plan.batchPlanCount} batch plan{plan.batchPlanCount !== 1 && 's'}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <GuidePlanDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        guidePlan={editingPlan}
        onSuccess={handleSuccess}
      />
    </>
  );
}
