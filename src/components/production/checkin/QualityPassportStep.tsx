'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Star, Bug, FileText, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MaterialSupplierData } from './MaterialSupplierStep';

export type QualityPassportData = {
  qualityRating: number;
  pestOrDisease: boolean;
  notes: string;
  passportOverride: boolean;
  operatorRegNo: string;
  originCountry: string;
  traceabilityCode: string;
};

type QualityPassportStepProps = {
  materialData: MaterialSupplierData;
  initialData: QualityPassportData | null;
  onComplete: (data: QualityPassportData) => void;
  onBack: () => void;
};

const RATING_OPTIONS = [
  { value: 6, label: 'Perfect', emoji: '💯', color: 'text-green-600' },
  { value: 5, label: 'Great', emoji: '😄', color: 'text-green-500' },
  { value: 4, label: 'Good', emoji: '🙂', color: 'text-lime-500' },
  { value: 3, label: 'Fair', emoji: '😐', color: 'text-yellow-500' },
  { value: 2, label: 'Poor', emoji: '😟', color: 'text-orange-500' },
  { value: 1, label: 'Reject', emoji: '☠️', color: 'text-red-600' },
];

export function QualityPassportStep({
  materialData,
  initialData,
  onComplete,
  onBack,
}: QualityPassportStepProps) {
  const [qualityRating, setQualityRating] = useState(initialData?.qualityRating ?? 5);
  const [pestOrDisease, setPestOrDisease] = useState(initialData?.pestOrDisease ?? false);
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [passportOverride, setPassportOverride] = useState(initialData?.passportOverride ?? false);
  const [operatorRegNo, setOperatorRegNo] = useState(
    initialData?.operatorRegNo ?? materialData.supplierProducerCode ?? ''
  );
  const [originCountry, setOriginCountry] = useState(
    initialData?.originCountry ?? materialData.supplierCountryCode ?? 'IE'
  );
  const [traceabilityCode, setTraceabilityCode] = useState(initialData?.traceabilityCode ?? '');

  const selectedRating = RATING_OPTIONS.find((r) => r.value === qualityRating);

  // Always valid since we have defaults
  const isValid = true;

  const handleSubmit = () => {
    onComplete({
      qualityRating,
      pestOrDisease,
      notes: notes.trim(),
      passportOverride,
      operatorRegNo: operatorRegNo.trim(),
      originCountry: originCountry.trim(),
      traceabilityCode: traceabilityCode.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Quality Rating */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Quality Rating
          </CardTitle>
          <CardDescription>
            Rate the incoming material quality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={qualityRating.toString()}
            onValueChange={(v) => setQualityRating(parseInt(v))}
          >
            <SelectTrigger className="h-14">
              <SelectValue>
                {selectedRating && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{selectedRating.emoji}</span>
                    <span className={cn('font-medium', selectedRating.color)}>
                      {selectedRating.label}
                    </span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RATING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{option.emoji}</span>
                    <span className={cn('font-medium', option.color)}>{option.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Rating visual indicator */}
          <div className="mt-4 flex gap-1">
            {RATING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setQualityRating(option.value)}
                className={cn(
                  'flex-1 h-2 rounded-full transition-colors',
                  option.value <= qualityRating
                    ? option.value >= 5
                      ? 'bg-green-500'
                      : option.value >= 3
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pest/Disease Flag */}
      <Card className={cn(pestOrDisease && 'border-orange-300 bg-orange-50')}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  pestOrDisease ? 'bg-orange-100' : 'bg-muted'
                )}
              >
                <Bug className={cn('h-5 w-5', pestOrDisease ? 'text-orange-600' : 'text-muted-foreground')} />
              </div>
              <div>
                <Label htmlFor="pest-disease" className="text-base font-medium cursor-pointer">
                  Pest or Disease Present?
                </Label>
                <p className="text-sm text-muted-foreground">
                  Flag if scouts or QC noted any issues
                </p>
              </div>
            </div>
            <Switch
              id="pest-disease"
              checked={pestOrDisease}
              onCheckedChange={setPestOrDisease}
            />
          </div>
          {pestOrDisease && (
            <div className="mt-4 p-3 bg-orange-100 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
              <p className="text-sm text-orange-800">
                This batch will be flagged for follow-up inspection. Add details in the notes below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notes
            <Badge variant="outline" className="font-normal">Optional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="QC observations, storage instructions, issues noted..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Plant Passport Override */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Plant Passport Override</CardTitle>
              <CardDescription>
                Defaults to supplier registration; toggle to override
              </CardDescription>
            </div>
            <Switch
              checked={passportOverride}
              onCheckedChange={setPassportOverride}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'grid gap-4 md:grid-cols-3 transition-opacity',
              !passportOverride && 'opacity-50 pointer-events-none'
            )}
          >
            <div className="space-y-2">
              <Label>Operator Reg. No.</Label>
              <Input
                value={operatorRegNo}
                onChange={(e) => setOperatorRegNo(e.target.value)}
                placeholder={materialData.supplierProducerCode ?? 'Producer code'}
                disabled={!passportOverride}
              />
            </div>
            <div className="space-y-2">
              <Label>Origin Country (ISO)</Label>
              <Input
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value.toUpperCase())}
                placeholder={materialData.supplierCountryCode ?? 'IE'}
                maxLength={2}
                disabled={!passportOverride}
              />
            </div>
            <div className="space-y-2">
              <Label>Traceability Code</Label>
              <Input
                value={traceabilityCode}
                onChange={(e) => setTraceabilityCode(e.target.value)}
                placeholder="Override supplier batch"
                disabled={!passportOverride}
              />
            </div>
          </div>

          {/* Current passport values preview */}
          {!passportOverride && materialData.supplierName && (
            <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Using supplier defaults:</p>
              <p className="text-muted-foreground">
                {materialData.supplierName}
                {materialData.supplierProducerCode && ` · ${materialData.supplierProducerCode}`}
                {materialData.supplierCountryCode && ` · ${materialData.supplierCountryCode}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={!isValid}>
          Review
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
