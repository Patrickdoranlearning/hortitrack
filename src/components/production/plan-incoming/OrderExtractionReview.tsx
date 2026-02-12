'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, AlertTriangle, X, FileCheck, ChevronRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchedExtraction, MatchedLineItem, MatchConfidence } from '@/lib/ai/match-extraction';
import type { ReferenceData } from '@/contexts/ReferenceDataContext';
import type { SupplierExpectedDateData } from './SupplierExpectedDateStep';
import type { PlannedBatchEntry } from './PlanBatchesStep';
import { GroupedCombobox } from '@/components/ui/grouped-combobox';

type OrderExtractionReviewProps = {
  extraction: MatchedExtraction;
  format: 'pdf' | 'csv';
  referenceData: ReferenceData;
  onConfirm: (supplierData: SupplierExpectedDateData, batches: PlannedBatchEntry[]) => void;
  onCancel: () => void;
};

// ─── Match Badge ────────────────────────────────────────────────────────────

function MatchBadge({ confidence }: { confidence: MatchConfidence }) {
  switch (confidence) {
    case 'exact':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <Check className="h-3 w-3" /> Matched
        </Badge>
      );
    case 'high':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <Check className="h-3 w-3" /> Matched
        </Badge>
      );
    case 'low':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
          <AlertTriangle className="h-3 w-3" /> Review
        </Badge>
      );
    case 'none':
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
          <X className="h-3 w-3" /> Unmatched
        </Badge>
      );
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function OrderExtractionReview({
  extraction,
  format,
  referenceData,
  onConfirm,
  onCancel,
}: OrderExtractionReviewProps) {
  // Track user overrides for each line item
  const [overrides, setOverrides] = useState<
    Record<number, { varietyId?: string; varietyName?: string; varietyFamily?: string | null; sizeId?: string; sizeName?: string }>
  >({});

  // Supplier override
  const [supplierOverride, setSupplierOverride] = useState<string | null>(null);

  // Variety options for combobox
  const varietyOptions = useMemo(
    () =>
      (referenceData.varieties ?? []).map((v) => ({
        value: v.id,
        label: v.name,
        group: v.family ?? 'Other',
        data: v,
      })),
    [referenceData.varieties]
  );

  // Size options for combobox
  const sizeOptions = useMemo(
    () =>
      (referenceData.sizes ?? []).map((s) => ({
        value: s.id,
        label: s.name,
        group: s.container_type ?? 'Other',
        data: s,
      })),
    [referenceData.sizes]
  );

  // Supplier options
  const supplierOptions = useMemo(
    () =>
      (referenceData.suppliers ?? []).map((s) => ({
        value: s.id,
        label: s.name,
        group: s.country_code ?? 'Other',
        data: s,
      })),
    [referenceData.suppliers]
  );

  // Get effective values (extraction + overrides)
  const getEffectiveVariety = (index: number, item: MatchedLineItem) => ({
    id: overrides[index]?.varietyId ?? item.matched_variety_id,
    name: overrides[index]?.varietyName ?? item.matched_variety_name,
    family: overrides[index]?.varietyFamily ?? item.matched_variety_family,
  });

  const getEffectiveSize = (index: number, item: MatchedLineItem) => ({
    id: overrides[index]?.sizeId ?? item.matched_size_id,
    name: overrides[index]?.sizeName ?? item.matched_size_name,
  });

  // Effective supplier ID
  const effectiveSupplierId = supplierOverride ?? extraction.matched_supplier_id;
  const effectiveSupplier = referenceData.suppliers?.find((s) => s.id === effectiveSupplierId);

  // Check if all items are resolved
  const allResolved = extraction.line_items.every((item, index) => {
    const variety = getEffectiveVariety(index, item);
    const size = getEffectiveSize(index, item);
    return variety.id && size.id;
  });

  const canConfirm = allResolved && effectiveSupplierId;

  // ── Handle Confirm ──────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!effectiveSupplierId || !effectiveSupplier) return;

    const supplierData: SupplierExpectedDateData = {
      supplierId: effectiveSupplierId,
      supplierName: effectiveSupplier.name,
      supplierProducerCode: effectiveSupplier.producer_code ?? null,
      supplierCountryCode: effectiveSupplier.country_code ?? null,
      expectedDate: extraction.expected_date ?? new Date().toISOString().split('T')[0],
      supplierReference: extraction.order_reference ?? '',
    };

    const batches: PlannedBatchEntry[] = extraction.line_items
      .map((item, index) => {
        const variety = getEffectiveVariety(index, item);
        const size = getEffectiveSize(index, item);
        if (!variety.id || !size.id) return null;

        return {
          id: `extracted-${Date.now()}-${index}`,
          varietyId: variety.id,
          varietyName: variety.name ?? item.extracted_variety_name,
          varietyFamily: variety.family ?? null,
          sizeId: size.id,
          sizeName: size.name ?? item.extracted_size,
          expectedQuantity: item.extracted_quantity,
        };
      })
      .filter((b): b is PlannedBatchEntry => b !== null);

    onConfirm(supplierData, batches);
  };

  // Count resolved items
  const resolvedCount = extraction.line_items.filter((item, index) => {
    const v = getEffectiveVariety(index, item);
    const s = getEffectiveSize(index, item);
    return v.id && s.id;
  }).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Order Data Extracted
            <Badge variant="outline" className="ml-auto text-xs font-normal">
              {format.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Supplier Match */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground w-20 shrink-0">Supplier</span>
            {extraction.matched_supplier_id && !supplierOverride ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {extraction.matched_supplier_name}
              </Badge>
            ) : supplierOverride ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {effectiveSupplier?.name}
              </Badge>
            ) : (
              <div className="flex-1 max-w-xs">
                <GroupedCombobox
                  options={supplierOptions}
                  value={effectiveSupplierId ?? undefined}
                  onSelect={(opt) => setSupplierOverride(opt.value)}
                  placeholder="Select supplier..."
                />
              </div>
            )}
            {extraction.extracted_supplier_name && !extraction.matched_supplier_id && (
              <span className="text-xs text-muted-foreground">
                (extracted: &quot;{extraction.extracted_supplier_name}&quot;)
              </span>
            )}
          </div>

          {/* Date & Reference */}
          {extraction.expected_date && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-20 shrink-0">Date</span>
              <span className="font-medium">{extraction.expected_date}</span>
            </div>
          )}
          {extraction.order_reference && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-20 shrink-0">Reference</span>
              <span className="font-medium">{extraction.order_reference}</span>
            </div>
          )}

          {/* Summary */}
          <div className="flex gap-3 text-xs pt-1">
            <Badge variant="secondary">
              {extraction.total_items} items
            </Badge>
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              {resolvedCount} resolved
            </Badge>
            {extraction.total_items - resolvedCount > 0 && (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                {extraction.total_items - resolvedCount} need review
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Line Items Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-3 py-2 text-left font-medium">Variety</th>
                <th className="px-3 py-2 text-left font-medium w-28">Status</th>
                <th className="px-3 py-2 text-left font-medium">Size</th>
                <th className="px-3 py-2 text-left font-medium w-28">Status</th>
                <th className="px-3 py-2 text-right font-medium w-16">Qty</th>
              </tr>
            </thead>
            <tbody>
              {extraction.line_items.map((item, index) => {
                const effectiveVariety = getEffectiveVariety(index, item);
                const effectiveSize = getEffectiveSize(index, item);
                const varietyResolved = !!effectiveVariety.id;
                const sizeResolved = !!effectiveSize.id;

                return (
                  <tr
                    key={index}
                    className={cn(
                      'border-b last:border-0',
                      (!varietyResolved || !sizeResolved) && 'bg-amber-50/30'
                    )}
                  >
                    {/* Variety */}
                    <td className="px-3 py-2">
                      {varietyResolved ? (
                        <div>
                          <span className="font-medium">{effectiveVariety.name}</span>
                          {effectiveVariety.name !== item.extracted_variety_name && (
                            <span className="block text-xs text-muted-foreground">
                              from: {item.extracted_variety_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground block">
                            {item.extracted_variety_name}
                          </span>
                          <GroupedCombobox
                            options={varietyOptions}
                            value={overrides[index]?.varietyId}
                            onSelect={(opt) =>
                              setOverrides((prev) => ({
                                ...prev,
                                [index]: {
                                  ...prev[index],
                                  varietyId: opt.value,
                                  varietyName: opt.label,
                                  varietyFamily: opt.data?.family ?? null,
                                },
                              }))
                            }
                            placeholder="Select variety..."
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {overrides[index]?.varietyId ? (
                        <MatchBadge confidence="exact" />
                      ) : (
                        <MatchBadge confidence={item.variety_match_confidence} />
                      )}
                    </td>

                    {/* Size */}
                    <td className="px-3 py-2">
                      {sizeResolved ? (
                        <div>
                          <span className="font-medium">{effectiveSize.name}</span>
                          {effectiveSize.name !== item.extracted_size && (
                            <span className="block text-xs text-muted-foreground">
                              from: {item.extracted_size}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground block">
                            {item.extracted_size}
                          </span>
                          <GroupedCombobox
                            options={sizeOptions}
                            value={overrides[index]?.sizeId}
                            onSelect={(opt) =>
                              setOverrides((prev) => ({
                                ...prev,
                                [index]: {
                                  ...prev[index],
                                  sizeId: opt.value,
                                  sizeName: opt.label,
                                },
                              }))
                            }
                            placeholder="Select size..."
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {overrides[index]?.sizeId ? (
                        <MatchBadge confidence="exact" />
                      ) : (
                        <MatchBadge confidence={item.size_match_confidence} />
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {item.extracted_quantity}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} size="sm">
          <RotateCcw className="h-4 w-4 mr-1" />
          Cancel / Re-upload
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          size="sm"
        >
          Use This Data
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {!canConfirm && (
        <p className="text-xs text-muted-foreground text-center">
          Resolve all unmatched items above to continue
        </p>
      )}
    </div>
  );
}
