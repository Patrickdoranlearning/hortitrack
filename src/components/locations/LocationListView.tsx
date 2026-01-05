'use client';

import * as React from 'react';
import { Printer, Eye, ChevronRight, Sprout, Package, MapPin } from 'lucide-react';
import type { NurseryLocation, Batch } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type LocationWithBatches = NurseryLocation & {
  batches: Batch[];
  batchCount: number;
  totalQuantity: number;
};

type LocationListViewProps = {
  locations: LocationWithBatches[];
  onView: (location: LocationWithBatches) => void;
  onPrint: (location: LocationWithBatches) => void;
};

export function LocationListView({ locations, onView, onPrint }: LocationListViewProps) {
  if (locations.length === 0) {
    return (
      <div className="text-center py-20">
        <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No Locations Found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Location</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-center">Batches</TableHead>
            <TableHead className="text-center">Plants</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map((location) => {
            // Get status summary
            const statusCounts: Record<string, number> = {};
            location.batches.forEach((batch) => {
              const status = batch.status || 'Unknown';
              statusCounts[status] = (statusCounts[status] || 0) + 1;
            });
            const topStatus = Object.entries(statusCounts)
              .sort(([, a], [, b]) => b - a)[0];

            return (
              <TableRow
                key={location.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onView(location)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {location.type?.toLowerCase() === 'tunnel' ? '🏕️' :
                       location.type?.toLowerCase() === 'glasshouse' ? '🏠' :
                       location.type?.toLowerCase() === 'outdoor' ? '🌳' : '📍'}
                    </span>
                    <div>
                      <div className="font-semibold">{location.name}</div>
                      {location.siteId && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {location.siteId}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{location.nurserySite || 'Main'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{location.type || '—'}</span>
                    {location.covered ? (
                      <Badge variant="secondary" className="text-xs">Covered</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Outdoor</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{location.batchCount}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Sprout className="h-4 w-4 text-emerald-600" />
                    <span className="font-semibold">{location.totalQuantity.toLocaleString()}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {topStatus ? (
                    <Badge variant="outline" className="text-xs">
                      {topStatus[0]}: {topStatus[1]}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">Empty</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrint(location);
                      }}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(location);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}





