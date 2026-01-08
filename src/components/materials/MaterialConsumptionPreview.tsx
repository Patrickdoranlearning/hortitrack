'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { Package, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchJson } from '@/lib/http/fetchJson';
import type { MaterialConsumptionPreview as ConsumptionPreviewType } from '@/lib/types/materials';

type ConsumptionBatch = {
  batchId: string;
  sizeId: string;
  sizeName: string;
  quantity: number;
};

type MaterialConsumptionPreviewProps = {
  batches: ConsumptionBatch[];
  className?: string;
};

type PreviewResponse = {
  preview: ConsumptionPreviewType[];
};

export function MaterialConsumptionPreview({ batches, className }: MaterialConsumptionPreviewProps) {
  // Group batches by size to reduce API calls
  const sizeQuantities = useMemo(() => {
    const map = new Map<string, { sizeId: string; sizeName: string; totalQty: number }>();
    batches.forEach((b) => {
      const existing = map.get(b.sizeId);
      if (existing) {
        existing.totalQty += b.quantity;
      } else {
        map.set(b.sizeId, { sizeId: b.sizeId, sizeName: b.sizeName, totalQty: b.quantity });
      }
    });
    return Array.from(map.values());
  }, [batches]);

  // Fetch consumption preview for each size
  const previewQueries = sizeQuantities.map((sq) => ({
    key: `/api/materials/consumption/preview?sizeId=${sq.sizeId}&quantity=${sq.totalQty}`,
    sizeId: sq.sizeId,
    sizeName: sq.sizeName,
    quantity: sq.totalQty,
  }));

  // Use first size as primary query (can be extended for multi-size)
  const primaryQuery = previewQueries[0];
  const { data, isLoading, error } = useSWR<PreviewResponse>(
    primaryQuery ? primaryQuery.key : null,
    (url) => fetchJson(url),
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  // Aggregate all previews
  const aggregatedPreviews = useMemo(() => {
    if (!data?.preview) return [];
    return data.preview;
  }, [data?.preview]);

  const hasShortages = aggregatedPreviews.some((p) => p.isShortage);
  const totalMaterials = aggregatedPreviews.length;

  if (sizeQuantities.length === 0 || batches.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Material Consumption
        </CardTitle>
        <CardDescription>
          Materials that will be consumed when activating these batches
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading materials...
          </div>
        ) : error ? (
          <div className="text-sm text-muted-foreground py-4">
            Unable to load material preview
          </div>
        ) : totalMaterials === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            <p>No materials linked to these sizes.</p>
            <p className="text-xs mt-1">
              Link materials in the Materials Catalog to enable auto-consumption.
            </p>
          </div>
        ) : (
          <>
            {hasShortages && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Some materials have insufficient stock. The batches can still be activated,
                  but stock levels will go negative.
                </AlertDescription>
              </Alert>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Required</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregatedPreviews.map((item) => (
                  <TableRow key={item.materialId}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{item.materialName}</span>
                        <span className="text-muted-foreground text-xs ml-2">
                          ({item.partNumber})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantityRequired.toLocaleString()} {item.baseUom}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={item.isShortage ? 'text-destructive font-medium' : ''}>
                        {item.quantityAvailable.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.isShortage ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Shortage
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 border-green-500 text-green-600"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 text-xs text-muted-foreground">
              <strong>Note:</strong> Materials will be automatically deducted from stock when
              batches are activated. Stock shortages will be recorded as negative inventory.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
