'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  Calendar,
  Package,
  MapPin,
  Loader2,
  Sprout,
  ArrowRightLeft,
  Briefcase,
} from 'lucide-react';
import type { PlanType } from './PlanTypeStep';
import type { PlanPropagationStepData, PlannedPropagationEntry } from './PlanPropagationStep';
import type { PlannedTransplantEntry } from './ConfigureTransplantsStep';

export type ReviewStepData = {
  globalNotes?: string;
  createJob: boolean;
  jobName?: string;
};

type ReviewStepProps = {
  planType: PlanType;
  plannedDate: string;
  plannedWeek?: string; // For transplants: ISO week format YYYY-Www
  propagationData?: PlanPropagationStepData;
  transplantData?: PlannedTransplantEntry[];
  initialData: ReviewStepData | null;
  onComplete: (data: ReviewStepData) => void;
  onBack: () => void;
  isSubmitting?: boolean;
};

// Helper to format week for display
function formatWeekDisplay(weekStr: string): string {
  if (!weekStr) return '';
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  const [, year, week] = match;
  // Calculate the Monday of this week
  const jan4 = new Date(parseInt(year), 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (parseInt(week) - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `Week ${week}: ${formatDate(monday)} - ${formatDate(sunday)}`;
}

export function ReviewStep({
  planType,
  plannedDate,
  plannedWeek,
  propagationData,
  transplantData,
  initialData,
  onComplete,
  onBack,
  isSubmitting = false,
}: ReviewStepProps) {
  const [globalNotes, setGlobalNotes] = useState(initialData?.globalNotes ?? '');
  const [createJob, setCreateJob] = useState(initialData?.createJob ?? false);
  const [jobName, setJobName] = useState(
    initialData?.jobName ?? `${planType === 'propagation' ? 'Propagation' : 'Transplant'} ${plannedDate || plannedWeek || ''}`
  );

  const handleSubmit = () => {
    onComplete({
      globalNotes: globalNotes || undefined,
      createJob,
      jobName: createJob ? jobName : undefined,
    });
  };

  const isPropagation = planType === 'propagation';
  const batches = isPropagation
    ? propagationData?.batches ?? []
    : transplantData ?? [];

  const totalBatches = batches.length;
  const totalUnits = isPropagation
    ? (propagationData?.batches ?? []).reduce((sum, b) => sum + b.expectedQuantity, 0)
    : (transplantData ?? []).reduce((sum, t) => sum + t.quantity, 0);
  const uniqueVarieties = new Set(
    isPropagation
      ? (propagationData?.batches ?? []).map((b) => b.varietyId)
      : (transplantData ?? []).map((t) => t.sourceBatchId)
  ).size;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isPropagation ? 'bg-green-100' : 'bg-blue-100'}`}>
                {isPropagation ? (
                  <Sprout className="h-5 w-5 text-green-600" />
                ) : (
                  <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <div className="text-2xl font-bold">{totalBatches}</div>
                <div className="text-sm text-muted-foreground">
                  {isPropagation ? 'Propagation' : 'Transplant'} Batch{totalBatches !== 1 ? 'es' : ''}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">
                  {isPropagation ? 'Plants' : 'Units to Transplant'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-lg font-bold">
                  {isPropagation && plannedDate ? (
                    new Date(plannedDate).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  ) : plannedWeek ? (
                    formatWeekDisplay(plannedWeek)
                  ) : (
                    '—'
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isPropagation ? 'Planned Date' : 'Planned Week'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batches Summary Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isPropagation ? 'Planned Propagation Batches' : 'Planned Transplants'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {!isPropagation && <TableHead>Source</TableHead>}
                <TableHead>Variety</TableHead>
                <TableHead>{isPropagation ? 'Tray Size' : 'Target Size'}</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPropagation
                ? (propagationData?.batches ?? []).map((batch: PlannedPropagationEntry) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{batch.varietyName}</span>
                          {batch.varietyFamily && (
                            <span className="text-muted-foreground ml-1">({batch.varietyFamily})</span>
                          )}
                        </div>
                        {batch.notes && (
                          <div className="text-xs text-muted-foreground mt-1">{batch.notes}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{batch.sizeName}</TableCell>
                      <TableCell className="text-right font-medium">
                        {batch.expectedQuantity.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {batch.locationName ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {batch.locationName}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">TBD</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                : (transplantData ?? []).map((t: PlannedTransplantEntry) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm">{t.sourceBatchNumber}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{t.varietyName}</span>
                          {t.varietyFamily && (
                            <span className="text-muted-foreground ml-1">({t.varietyFamily})</span>
                          )}
                        </div>
                        {t.notes && (
                          <div className="text-xs text-muted-foreground mt-1">{t.notes}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.targetSizeName}</TableCell>
                      <TableCell className="text-right font-medium">
                        {t.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {t.locationName ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {t.locationName}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">TBD</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Production Job */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Production Job
            <Badge variant="outline" className="font-normal text-xs">Optional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="create-job">Create a production job</Label>
              <p className="text-sm text-muted-foreground">
                Group these batches into an assignable job for your team
              </p>
            </div>
            <Switch
              id="create-job"
              checked={createJob}
              onCheckedChange={setCreateJob}
            />
          </div>

          {createJob && (
            <div className="space-y-2">
              <Label>Job Name</Label>
              <Input
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="Enter job name..."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Additional Notes
            <Badge variant="outline" className="ml-2 font-normal text-xs">Optional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={globalNotes}
            onChange={(e) => setGlobalNotes(e.target.value)}
            placeholder="Any additional notes about this plan..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Info Message */}
      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
        <p>
          <strong>What happens next:</strong> These batches will be created with "Planned" status.
          {!isPropagation && ' Quantity will be reserved on source batches.'}
          {' '}When you're ready to execute, the batches can be activated to start production.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Plan {totalBatches} Batch{totalBatches !== 1 ? 'es' : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
