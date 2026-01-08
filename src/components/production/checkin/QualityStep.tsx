'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Bug,
  ThermometerSun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BatchEntry } from './BatchesStep';

export type BatchQuality = {
  batchId: string;
  qualityRating: number; // 1-6
  hasPestOrDisease: boolean;
  notes: string;
};

export type QualityStepData = {
  overallQuality: number;
  batchQualities: BatchQuality[];
  globalNotes: string;
};

type QualityStepProps = {
  batches: BatchEntry[];
  initialData: QualityStepData | null;
  onComplete: (data: QualityStepData) => void;
  onBack: () => void;
};

const QUALITY_LABELS: Record<number, { label: string; emoji: string; color: string }> = {
  1: { label: 'Poor', emoji: '😟', color: 'text-red-600' },
  2: { label: 'Below Average', emoji: '😕', color: 'text-orange-600' },
  3: { label: 'Average', emoji: '😐', color: 'text-yellow-600' },
  4: { label: 'Good', emoji: '🙂', color: 'text-lime-600' },
  5: { label: 'Very Good', emoji: '😊', color: 'text-green-600' },
  6: { label: 'Excellent', emoji: '🤩', color: 'text-emerald-600' },
};

export function QualityStep({
  batches,
  initialData,
  onComplete,
  onBack,
}: QualityStepProps) {
  const [overallQuality, setOverallQuality] = useState(initialData?.overallQuality ?? 4);
  const [globalNotes, setGlobalNotes] = useState(initialData?.globalNotes ?? '');
  const [batchQualities, setBatchQualities] = useState<Map<string, BatchQuality>>(() => {
    const map = new Map();
    // Initialize with existing data or defaults
    batches.forEach((batch) => {
      const existing = initialData?.batchQualities.find((q) => q.batchId === batch.id);
      map.set(batch.id, existing ?? {
        batchId: batch.id,
        qualityRating: initialData?.overallQuality ?? 4,
        hasPestOrDisease: false,
        notes: '',
      });
    });
    return map;
  });
  const [hasIssues, setHasIssues] = useState(
    initialData?.batchQualities.some((q) => q.hasPestOrDisease || q.qualityRating < 3) ?? false
  );

  // Update batch quality
  const updateBatchQuality = useCallback((batchId: string, updates: Partial<BatchQuality>) => {
    setBatchQualities((prev) => {
      const next = new Map(prev);
      const current = next.get(batchId)!;
      next.set(batchId, { ...current, ...updates });
      return next;
    });
  }, []);

  // Apply overall quality to all batches
  const applyOverallToAll = useCallback(() => {
    setBatchQualities((prev) => {
      const next = new Map(prev);
      batches.forEach((batch) => {
        const current = next.get(batch.id)!;
        next.set(batch.id, { ...current, qualityRating: overallQuality });
      });
      return next;
    });
  }, [batches, overallQuality]);

  // Count issues
  const issueCount = Array.from(batchQualities.values()).filter(
    (q) => q.hasPestOrDisease || q.qualityRating < 3
  ).length;

  const handleSubmit = () => {
    onComplete({
      overallQuality,
      batchQualities: Array.from(batchQualities.values()),
      globalNotes,
    });
  };

  const qualityInfo = QUALITY_LABELS[overallQuality];

  return (
    <div className="space-y-6">
      {/* Issue Alert */}
      {issueCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              {issueCount} batch{issueCount !== 1 ? 'es' : ''} flagged with quality issues
            </span>
          </CardContent>
        </Card>
      )}

      {/* Overall Quality */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ThermometerSun className="h-4 w-4" />
            Overall Delivery Quality
          </CardTitle>
          <CardDescription>
            Rate the general quality of this delivery. You can adjust individual batches below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Slider
              value={[overallQuality]}
              onValueChange={([v]) => setOverallQuality(v)}
              min={1}
              max={6}
              step={1}
              className="flex-1"
            />
            <div className={cn('text-2xl font-bold w-20 text-center', qualityInfo.color)}>
              {qualityInfo.emoji} {overallQuality}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={cn('text-sm font-medium', qualityInfo.color)}>
              {qualityInfo.label}
            </span>
            <Button variant="outline" size="sm" onClick={applyOverallToAll}>
              Apply to all batches
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Toggle for batch-specific issues */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Any issues with specific batches?</Label>
              <p className="text-sm text-muted-foreground">
                Flag individual batches with pest/disease or quality concerns
              </p>
            </div>
            <Switch checked={hasIssues} onCheckedChange={setHasIssues} />
          </div>
        </CardContent>
      </Card>

      {/* Per-Batch Quality (expandable) */}
      {hasIssues && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Batch-Specific Quality</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion type="multiple" className="w-full">
              {batches.map((batch) => {
                const quality = batchQualities.get(batch.id)!;
                const batchQualityInfo = QUALITY_LABELS[quality.qualityRating];
                const hasFlag = quality.hasPestOrDisease || quality.qualityRating < 3;

                return (
                  <AccordionItem key={batch.id} value={batch.id} className="border-b last:border-0">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-3 flex-1 mr-4">
                        <div className="flex-1 text-left">
                          <span className="font-medium">{batch.varietyName}</span>
                          <span className="text-muted-foreground ml-2">
                            · {batch.sizeName} · {batch.quantity} units
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasFlag && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Issue
                            </Badge>
                          )}
                          <span className={cn('text-lg', batchQualityInfo.color)}>
                            {batchQualityInfo.emoji}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-4">
                      {/* Quality Rating */}
                      <div className="space-y-2">
                        <Label>Quality Rating</Label>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[quality.qualityRating]}
                            onValueChange={([v]) =>
                              updateBatchQuality(batch.id, { qualityRating: v })
                            }
                            min={1}
                            max={6}
                            step={1}
                            className="flex-1"
                          />
                          <span className={cn('font-medium w-16', batchQualityInfo.color)}>
                            {batchQualityInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Pest/Disease Flag */}
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Bug className="h-4 w-4 text-muted-foreground" />
                          <Label className="cursor-pointer">Pest or Disease Present</Label>
                        </div>
                        <Switch
                          checked={quality.hasPestOrDisease}
                          onCheckedChange={(checked) =>
                            updateBatchQuality(batch.id, { hasPestOrDisease: checked })
                          }
                        />
                      </div>

                      {/* Notes */}
                      <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          placeholder="Describe any issues observed..."
                          value={quality.notes}
                          onChange={(e) =>
                            updateBatchQuality(batch.id, { notes: e.target.value })
                          }
                          rows={2}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Global Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Delivery Notes</CardTitle>
          <CardDescription>Any general notes about this delivery</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g., Arrived on time, good packaging, some trays were damp..."
            value={globalNotes}
            onChange={(e) => setGlobalNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button type="button" onClick={handleSubmit}>
          Next: Photos
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
