'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  Check,
  Loader2,
  Package,
  MapPin,
  Calendar,
  Star,
  Bug,
  FileText,
  Pencil,
  Truck,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MaterialSupplierData } from './MaterialSupplierStep';
import type { LocationQuantityData } from './LocationQuantityStep';
import type { QualityPassportData } from './QualityPassportStep';

type CheckInReviewStepProps = {
  materialData: MaterialSupplierData;
  locationData: LocationQuantityData;
  qualityData: QualityPassportData;
  onSubmit: () => void;
  onBack: () => void;
  onEdit: (step: 'material' | 'location' | 'quality' | 'review') => void;
  isSaving: boolean;
};

const RATING_LABELS: Record<number, { label: string; emoji: string; color: string }> = {
  6: { label: 'Perfect', emoji: '💯', color: 'text-green-600' },
  5: { label: 'Great', emoji: '😄', color: 'text-green-500' },
  4: { label: 'Good', emoji: '🙂', color: 'text-lime-500' },
  3: { label: 'Fair', emoji: '😐', color: 'text-yellow-500' },
  2: { label: 'Poor', emoji: '😟', color: 'text-orange-500' },
  1: { label: 'Reject', emoji: '☠️', color: 'text-red-600' },
};

function SummaryRow({
  icon: Icon,
  label,
  value,
  subValue,
  highlight,
}: {
  icon?: React.ElementType;
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-right">
        <span className={cn('font-medium', highlight && 'text-primary text-lg')}>{value}</span>
        {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
      </div>
    </div>
  );
}

export function CheckInReviewStep({
  materialData,
  locationData,
  qualityData,
  onSubmit,
  onBack,
  onEdit,
  isSaving,
}: CheckInReviewStepProps) {
  const rating = RATING_LABELS[qualityData.qualityRating];

  // Estimate ready date
  const estimatedReadyDate = (() => {
    if (!locationData.incomingDate) return null;
    const date = new Date(locationData.incomingDate);
    date.setDate(date.getDate() + 21);
    return date.toISOString().slice(0, 10);
  })();

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Package className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">{materialData.varietyName}</h2>
        <p className="text-muted-foreground">
          {locationData.totalUnits.toLocaleString()} units · {materialData.phase}
        </p>
      </div>

      {/* Warning if pest/disease flagged */}
      {qualityData.pestOrDisease && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-800">Pest/Disease Flagged</p>
              <p className="text-sm text-orange-700">This batch will require follow-up inspection</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Material & Supplier Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Material & Supplier
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEdit('material')}>
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <SummaryRow label="Variety" value={materialData.varietyName} subValue={materialData.varietyFamily} />
          <SummaryRow
            label="Size"
            value={materialData.sizeName}
            subValue={materialData.cellMultiple > 1 ? `×${materialData.cellMultiple} cells per container` : undefined}
          />
          <SummaryRow label="Phase" value={<span className="capitalize">{materialData.phase}</span>} />
          <SummaryRow
            icon={Truck}
            label="Supplier"
            value={materialData.supplierName ?? <span className="text-muted-foreground">Not set</span>}
            subValue={materialData.supplierProducerCode}
          />
        </CardContent>
      </Card>

      {/* Location & Quantity Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location & Quantity
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEdit('location')}>
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <SummaryRow icon={MapPin} label="Location" value={locationData.locationName} />
          <SummaryRow icon={Calendar} label="Incoming Date" value={locationData.incomingDate} />
          <SummaryRow label="Containers" value={locationData.containers} />
          <SummaryRow label="Total Units" value={locationData.totalUnits.toLocaleString()} highlight />
          <SummaryRow label="Supplier Batch" value={locationData.supplierBatchNumber || '—'} />
          {estimatedReadyDate && (
            <SummaryRow label="Est. Ready Date" value={estimatedReadyDate} />
          )}
        </CardContent>
      </Card>

      {/* Quality & Passport Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4" />
              Quality & Passport
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEdit('quality')}>
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <SummaryRow
            icon={Star}
            label="Quality Rating"
            value={
              <span className={cn('flex items-center gap-2', rating?.color)}>
                <span>{rating?.emoji}</span>
                <span>{rating?.label}</span>
              </span>
            }
          />
          <SummaryRow
            icon={Bug}
            label="Pest/Disease"
            value={
              qualityData.pestOrDisease ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Flagged
                </Badge>
              ) : (
                <Badge variant="secondary">Clear</Badge>
              )
            }
          />
          {qualityData.notes && (
            <SummaryRow
              icon={FileText}
              label="Notes"
              value={<span className="max-w-[200px] truncate block">{qualityData.notes}</span>}
            />
          )}
          {qualityData.passportOverride && (
            <>
              <div className="pt-2 mt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Passport Override</p>
              </div>
              <SummaryRow label="Operator Reg." value={qualityData.operatorRegNo || '—'} />
              <SummaryRow label="Origin Country" value={qualityData.originCountry || '—'} />
              <SummaryRow label="Traceability" value={qualityData.traceabilityCode || '—'} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Total Summary Banner */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-primary-foreground/70 text-sm">Containers</p>
              <p className="text-2xl font-bold">{locationData.containers}</p>
            </div>
            <div>
              <p className="text-primary-foreground/70 text-sm">Total Units</p>
              <p className="text-3xl font-bold">{locationData.totalUnits.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-primary-foreground/70 text-sm">Quality</p>
              <p className="text-2xl font-bold">{rating?.emoji} {rating?.label}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isSaving}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          size="lg"
          className="min-w-[160px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking in...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Check In Batch
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
