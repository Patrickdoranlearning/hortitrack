'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
  Printer,
  MapPin,
  Sprout,
  Package,
  Calendar,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type { NurseryLocation, Batch } from '@/lib/types';
import { useBatchDetailDialog } from '@/stores/useBatchDetailDialog';

type LocationWithBatches = NurseryLocation & {
  batches: Batch[];
  batchCount: number;
  totalQuantity: number;
};

type LocationDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationWithBatches | null;
  onPrintLabel: (location: LocationWithBatches) => void;
};

export function LocationDetailDialog({
  open,
  onOpenChange,
  location,
  onPrintLabel,
}: LocationDetailDialogProps) {
  const batchDialog = useBatchDetailDialog();
  const locationBatches = location?.batches ?? [];

  // Group batches by status
  const batchesByStatus = React.useMemo(() => {
    const groups: Record<string, Batch[]> = {};
    locationBatches.forEach((batch) => {
      const status = batch.status || 'Unknown';
      if (!groups[status]) groups[status] = [];
      groups[status].push(batch);
    });
    return groups;
  }, [locationBatches]);

  // Get variety breakdown
  const varietyBreakdown = React.useMemo(() => {
    const counts: Record<string, { name: string; family?: string; count: number; batches: number }> = {};
    locationBatches.forEach((batch) => {
      const name = batch.plantVariety || 'Unknown';
      if (!counts[name]) {
        counts[name] = { name, family: batch.plantFamily, count: 0, batches: 0 };
      }
      counts[name].count += batch.quantity ?? 0;
      counts[name].batches += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [locationBatches]);

  // Get potting date summary
  const pottingDates = React.useMemo(() => {
    const dates: { date: string; count: number }[] = [];
    const dateCounts: Record<string, number> = {};
    locationBatches.forEach((batch) => {
      const date = batch.plantedAt || batch.plantingDate;
      if (date) {
        const dateStr = new Date(date).toLocaleDateString();
        dateCounts[dateStr] = (dateCounts[dateStr] || 0) + (batch.quantity ?? 0);
      }
    });
    Object.entries(dateCounts)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .forEach(([date, count]) => {
        dates.push({ date, count });
      });
    return dates.slice(0, 5);
  }, [locationBatches]);

  if (!location) return null;

  const handleViewBatch = (batch: Batch) => {
    onOpenChange(false);
    setTimeout(() => {
      batchDialog.open(batch.id!);
    }, 100);
  };

  const getTypeIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'tunnel':
        return '🏕️';
      case 'glasshouse':
        return '🏠';
      case 'outdoor':
        return '🌳';
      case 'polytunnel':
        return '🌿';
      default:
        return '📍';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] grid-rows-[auto_1fr]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getTypeIcon(location.type)}</span>
              <div>
                <DialogTitle className="font-headline text-2xl">{location.name}</DialogTitle>
                <DialogDescription>
                  {location.nurserySite || 'Main'} • {location.type || 'Section'}
                  {location.siteId && ` • ID: ${location.siteId}`}
                </DialogDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(`/production/locations/${location.id}/print`, '_blank', 'noopener')}
              >
                <Printer className="mr-2 h-4 w-4" />
                Desktop (A4)
              </Button>
              <Button variant="outline" size="sm" onClick={() => onPrintLabel(location)}>
                <Printer className="mr-2 h-4 w-4" />
                Label Printer
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto pr-2 -mr-2">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Package className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{location.batchCount}</p>
              <p className="text-xs text-muted-foreground">Batches</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Sprout className="h-6 w-6 mx-auto text-emerald-600 mb-2" />
              <p className="text-2xl font-bold">{location.totalQuantity.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Plants</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <MapPin className="h-6 w-6 mx-auto text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{location.area ? `${location.area}m²` : '—'}</p>
              <p className="text-xs text-muted-foreground">Area</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Calendar className="h-6 w-6 mx-auto text-amber-600 mb-2" />
              <p className="text-2xl font-bold">{varietyBreakdown.length}</p>
              <p className="text-xs text-muted-foreground">Varieties</p>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant={location.covered ? 'default' : 'outline'}>
              {location.covered ? '🏠 Covered' : '☀️ Uncovered'}
            </Badge>
            {Object.entries(batchesByStatus).map(([status, batches]) => (
              <Badge key={status} variant="secondary">
                {status}: {batches.length}
              </Badge>
            ))}
          </div>

          <Tabs defaultValue="batches">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="batches">Batches</TabsTrigger>
              <TabsTrigger value="varieties">Varieties</TabsTrigger>
              <TabsTrigger value="timeline">Potting Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="batches" className="mt-4">
              {location.batches.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch #</TableHead>
                        <TableHead>Variety</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Potted</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {location.batches.map((batch) => (
                        <TableRow
                          key={batch.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewBatch(batch)}
                        >
                          <TableCell className="font-mono text-sm">
                            {batch.batchNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{batch.plantVariety || '—'}</div>
                              {batch.plantFamily && (
                                <div className="text-xs text-muted-foreground">
                                  {batch.plantFamily}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{batch.size || '—'}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {(batch.quantity ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {batch.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {batch.plantedAt || batch.plantingDate
                              ? new Date(batch.plantedAt || batch.plantingDate!).toLocaleDateString()
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No batches in this location</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="varieties" className="mt-4 space-y-4">
              {varietyBreakdown.length > 0 ? (
                varietyBreakdown.map((variety) => (
                  <div key={variety.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{variety.name}</span>
                        {variety.family && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({variety.family})
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{variety.count.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground ml-1">plants</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {variety.batches} batch{variety.batches !== 1 ? 'es' : ''}
                        </Badge>
                      </div>
                    </div>
                    <Progress
                      value={(variety.count / location.totalQuantity) * 100}
                      className="h-2"
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Sprout className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No varieties in this location</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              {pottingDates.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Recent potting activity in this location:
                  </p>
                  {pottingDates.map(({ date, count }) => (
                    <div
                      key={date}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{date}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{count.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground ml-1">plants potted</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No potting dates recorded</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

