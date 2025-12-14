'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Truck,
  Calendar,
  FileText,
  Package,
  MapPin,
  Loader2,
} from 'lucide-react';
import type { SupplierExpectedDateData } from './SupplierExpectedDateStep';
import type { PlanBatchesStepData, PlannedBatchEntry } from './PlanBatchesStep';

export type ReviewStepData = {
  globalNotes?: string;
};

type ReviewStepProps = {
  supplierData: SupplierExpectedDateData;
  batchesData: PlanBatchesStepData;
  initialData: ReviewStepData | null;
  onComplete: (data: ReviewStepData) => void;
  onBack: () => void;
  isSubmitting?: boolean;
};

export function ReviewStep({
  supplierData,
  batchesData,
  initialData,
  onComplete,
  onBack,
  isSubmitting = false,
}: ReviewStepProps) {
  const [globalNotes, setGlobalNotes] = useState(initialData?.globalNotes ?? '');

  const handleSubmit = () => {
    onComplete({ globalNotes: globalNotes || undefined });
  };

  const totalBatches = batchesData.batches.length;
  const totalUnits = batchesData.batches.reduce((sum, b) => sum + b.expectedQuantity, 0);
  const uniqueVarieties = new Set(batchesData.batches.map((b) => b.varietyId)).size;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalBatches}</div>
                <div className="text-sm text-muted-foreground">Batch{totalBatches !== 1 ? 'es' : ''}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Expected Units</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{uniqueVarieties}</div>
                <div className="text-sm text-muted-foreground">Variet{uniqueVarieties !== 1 ? 'ies' : 'y'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Delivery Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Supplier:</span>
            <span className="font-medium">{supplierData.supplierName}</span>
            {supplierData.supplierProducerCode && (
              <Badge variant="outline">{supplierData.supplierProducerCode}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Expected Date:</span>
            <span className="font-medium">
              {new Date(supplierData.expectedDate).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          {supplierData.supplierReference && (
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Reference:</span>
              <span className="font-medium">{supplierData.supplierReference}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batches Summary Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Planned Batches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variety</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Expected Qty</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batchesData.batches.map((batch) => (
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Global Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Additional Notes
            <Badge variant="outline" className="font-normal text-xs">Optional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={globalNotes}
            onChange={(e) => setGlobalNotes(e.target.value)}
            placeholder="Any additional notes about this planned delivery..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Info Message */}
      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
        <p>
          <strong>What happens next:</strong> These batches will be created with "Incoming" status.
          When the delivery arrives, you can use the <strong>Check-in</strong> wizard to confirm
          arrival and record actual quantities.
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
