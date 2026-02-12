'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Check, ChevronRight, Truck, Calendar, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReferenceData } from '@/contexts/ReferenceDataContext';
import { useTodayDate } from '@/lib/date-sync';
import { toast } from '@/lib/toast';
import { OrderUploadZone } from './OrderUploadZone';
import { OrderExtractionReview } from './OrderExtractionReview';
import type { MatchedExtraction } from '@/lib/ai/match-extraction';
import type { PlannedBatchEntry } from './PlanBatchesStep';

export type SupplierExpectedDateData = {
  supplierId: string;
  supplierName: string;
  supplierProducerCode: string | null;
  supplierCountryCode: string | null;
  expectedDate: string;
  supplierReference: string;
};

type SupplierExpectedDateStepProps = {
  referenceData: ReferenceData;
  initialData: SupplierExpectedDateData | null;
  onComplete: (data: SupplierExpectedDateData) => void;
  onExtractionConfirmed?: (supplierData: SupplierExpectedDateData, batches: PlannedBatchEntry[]) => void;
  onCancel?: () => void;
};

export function SupplierExpectedDateStep({
  referenceData,
  initialData,
  onComplete,
  onExtractionConfirmed,
  onCancel,
}: SupplierExpectedDateStepProps) {
  // Use hydration-safe date to prevent server/client mismatch
  const today = useTodayDate();
  const [supplierId, setSupplierId] = useState(initialData?.supplierId ?? '');
  const [expectedDate, setExpectedDate] = useState(initialData?.expectedDate ?? '');
  const [supplierReference, setSupplierReference] = useState(initialData?.supplierReference ?? '');

  // Order upload extraction state
  const [extraction, setExtraction] = useState<MatchedExtraction | null>(null);
  const [extractionFormat, setExtractionFormat] = useState<'pdf' | 'csv'>('pdf');

  const handleExtractionComplete = useCallback(
    (result: MatchedExtraction, format: 'pdf' | 'csv') => {
      setExtraction(result);
      setExtractionFormat(format);
    },
    []
  );

  const handleExtractionError = useCallback((message: string) => {
    toast.error('Extraction failed', { description: message });
  }, []);

  const handleExtractionCancel = useCallback(() => {
    setExtraction(null);
  }, []);

  const handleExtractionConfirm = useCallback(
    (supplierData: SupplierExpectedDateData, batches: PlannedBatchEntry[]) => {
      setExtraction(null);
      if (onExtractionConfirmed) {
        onExtractionConfirmed(supplierData, batches);
      }
    },
    [onExtractionConfirmed]
  );

  // Set date after hydration if not provided
  useEffect(() => {
    if (today && !expectedDate && !initialData?.expectedDate) {
      setExpectedDate(today);
    }
  }, [today, expectedDate, initialData?.expectedDate]);

  const suppliers = referenceData.suppliers ?? [];

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId),
    [suppliers, supplierId]
  );

  // Validation - supplier and date are required
  const isValid = supplierId && expectedDate;

  const handleSubmit = () => {
    if (!isValid || !selectedSupplier) return;

    onComplete({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      supplierProducerCode: selectedSupplier.producer_code ?? null,
      supplierCountryCode: selectedSupplier.country_code ?? null,
      expectedDate,
      supplierReference,
    });
  };

  // Readiness indicators
  const readiness = [
    { label: 'Supplier', ok: !!supplierId },
    { label: 'Expected Date', ok: !!expectedDate },
    { label: 'Reference', ok: !!supplierReference, optional: true },
  ];

  return (
    <div className="space-y-6">
      {/* No Suppliers Warning */}
      {suppliers.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">No suppliers configured</p>
                <p className="text-sm text-amber-700 mt-1">
                  You need to add suppliers before planning incoming stock.{' '}
                  <a href="/suppliers" className="underline font-medium hover:text-amber-800">
                    Add your first supplier
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Upload Zone */}
      {!extraction && onExtractionConfirmed && (
        <OrderUploadZone
          onExtractionComplete={handleExtractionComplete}
          onError={handleExtractionError}
        />
      )}

      {/* Extraction Review */}
      {extraction && (
        <OrderExtractionReview
          extraction={extraction}
          format={extractionFormat}
          referenceData={referenceData}
          onConfirm={handleExtractionConfirm}
          onCancel={handleExtractionCancel}
        />
      )}

      {/* Completion Status */}
      <div className="flex flex-wrap gap-2">
        {readiness.map((item) => (
          <Badge
            key={item.label}
            variant={item.ok ? 'default' : 'secondary'}
            className={cn(
              item.ok ? 'bg-green-100 text-green-700' : 'bg-muted',
              item.optional && !item.ok && 'opacity-60'
            )}
          >
            {item.ok && <Check className="h-3 w-3 mr-1" />}
            {item.label}
            {item.optional && !item.ok && ' (optional)'}
          </Badge>
        ))}
      </div>

      {/* Supplier Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Supplier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SearchableSelect
            options={suppliers.map((s) => ({
              value: s.id,
              label: s.name,
              description: s.producer_code ? `· ${s.producer_code}` : undefined,
            }))}
            value={supplierId}
            onValueChange={(value) => setSupplierId(value)}
            placeholder="Select supplier..."
            searchPlaceholder="Search suppliers..."
            createHref="/suppliers"
            createLabel="Add new supplier"
            className="h-12"
          />
        </CardContent>
      </Card>

      {/* Expected Date & Reference */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Expected Delivery Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="h-12"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Supplier Reference
              <Badge variant="outline" className="font-normal text-xs">Optional</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="PO number / Order reference..."
              value={supplierReference}
              onChange={(e) => setSupplierReference(e.target.value)}
              className="h-12"
            />
          </CardContent>
        </Card>
      </div>

      {/* Supplier Info Card */}
      {selectedSupplier && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Producer Code</span>
                <span className="font-medium">{selectedSupplier.producer_code || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country</span>
                <span className="font-medium">{selectedSupplier.country_code || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <div />
        )}
        <Button type="button" onClick={handleSubmit} disabled={!isValid}>
          Next: Add Batches
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
