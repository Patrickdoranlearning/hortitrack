'use client';

import * as React from 'react';
import { Printer, Eye, MapPin, Sprout, Package, ChevronRight } from 'lucide-react';
import type { NurseryLocation, Batch } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type LocationWithBatches = NurseryLocation & {
  batches: Batch[];
  batchCount: number;
  totalQuantity: number;
};

type LocationCardProps = {
  location: LocationWithBatches;
  onView: (location: LocationWithBatches) => void;
  onPrint: (location: LocationWithBatches) => void;
  className?: string;
};

export function LocationCard({ location, onView, onPrint, className }: LocationCardProps) {
  // Calculate capacity utilization (if area is available)
  const capacityPercentage = location.area && location.totalQuantity > 0 
    ? Math.min(100, (location.totalQuantity / (location.area * 10)) * 100) // rough estimate: 10 plants/m²
    : 0;

  // Get top varieties in this location
  const topVarieties = React.useMemo(() => {
    const varietyCounts: Record<string, { name: string; count: number }> = {};
    location.batches.forEach((batch) => {
      const name = batch.plantVariety || 'Unknown';
      if (!varietyCounts[name]) {
        varietyCounts[name] = { name, count: 0 };
      }
      varietyCounts[name].count += batch.quantity ?? 0;
    });
    return Object.values(varietyCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [location.batches]);

  // Get status breakdown
  const statusBreakdown = React.useMemo(() => {
    const counts: Record<string, number> = {};
    location.batches.forEach((batch) => {
      const status = batch.status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [location.batches]);

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
    <Card
      className={cn(
        'relative group overflow-hidden transition-all hover:shadow-lg cursor-pointer',
        location.batchCount === 0 && 'opacity-70',
        className
      )}
      onClick={() => onView(location)}
    >
      {/* Background gradient based on type */}
      <div
        className={cn(
          'absolute inset-0 opacity-5',
          location.covered ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-amber-500 to-orange-500'
        )}
      />

      <CardHeader className="relative pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl flex-shrink-0">{getTypeIcon(location.type)}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-lg truncate">{location.name}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {location.nurserySite || 'Main'} • {location.type || 'Section'}
              </p>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
              <span className="sr-only">Print Label</span>
            </Button>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge variant={location.covered ? 'secondary' : 'outline'} className="text-xs">
            {location.covered ? '🏠 Covered' : '☀️ Uncovered'}
          </Badge>
          {location.area && (
            <Badge variant="outline" className="text-xs">
              {location.area.toLocaleString()} m²
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{location.batchCount}</p>
              <p className="text-xs text-muted-foreground">Batches</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-500/10">
              <Sprout className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{location.totalQuantity.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Plants</p>
            </div>
          </div>
        </div>

        {/* Top varieties */}
        {topVarieties.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Top Varieties
            </p>
            <div className="space-y-1.5">
              {topVarieties.map((v) => (
                <div key={v.name} className="flex items-center justify-between text-sm">
                  <span className="truncate">{v.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {v.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Capacity indicator */}
        {location.area && capacityPercentage > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Estimated Capacity</span>
              <span className="font-medium">{Math.round(capacityPercentage)}%</span>
            </div>
            <Progress value={capacityPercentage} className="h-1.5" />
          </div>
        )}

        {/* Status breakdown */}
        {Object.keys(statusBreakdown).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <Badge key={status} variant="outline" className="text-xs">
                {status}: {count}
              </Badge>
            ))}
          </div>
        )}

        {/* Empty state */}
        {location.batchCount === 0 && (
          <div className="text-center py-4">
            <MapPin className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mt-2">No batches in this location</p>
          </div>
        )}

        {/* View details indicator */}
        <div className="flex items-center justify-end text-sm text-muted-foreground group-hover:text-primary transition-colors">
          <span>View details</span>
          <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </CardContent>
    </Card>
  );
}




