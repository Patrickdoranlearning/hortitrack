'use client';

import * as React from 'react';
import { MapPin, Sprout, Package } from 'lucide-react';
import type { NurseryLocation, Batch } from '@/lib/types';
import { cn } from '@/lib/utils';

type LocationWithBatches = NurseryLocation & {
  batches: Batch[];
  batchCount: number;
  totalQuantity: number;
};

type LocationMapViewProps = {
  locations: LocationWithBatches[];
  onSelectLocation: (location: LocationWithBatches) => void;
};

export function LocationMapView({ locations, onSelectLocation }: LocationMapViewProps) {
  // Group locations by nursery site
  const groupedBySite = React.useMemo(() => {
    const groups: Record<string, LocationWithBatches[]> = {};
    locations.forEach((loc) => {
      const site = loc.nurserySite || 'Main';
      if (!groups[site]) groups[site] = [];
      groups[site].push(loc);
    });
    return groups;
  }, [locations]);

  // Calculate total plants per site
  const siteTotals = React.useMemo(() => {
    const totals: Record<string, { batches: number; plants: number }> = {};
    Object.entries(groupedBySite).forEach(([site, locs]) => {
      totals[site] = {
        batches: locs.reduce((sum, l) => sum + l.batchCount, 0),
        plants: locs.reduce((sum, l) => sum + l.totalQuantity, 0),
      };
    });
    return totals;
  }, [groupedBySite]);

  const getTypeColor = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'tunnel':
        return 'bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30';
      case 'glasshouse':
        return 'bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/30';
      case 'polytunnel':
        return 'bg-teal-500/20 border-teal-500/40 hover:bg-teal-500/30';
      case 'outdoor':
        return 'bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30';
      default:
        return 'bg-gray-500/20 border-gray-500/40 hover:bg-gray-500/30';
    }
  };

  const getCapacityLevel = (location: LocationWithBatches) => {
    if (!location.area || location.totalQuantity === 0) return 'empty';
    const capacity = (location.totalQuantity / (location.area * 10)) * 100;
    if (capacity >= 80) return 'high';
    if (capacity >= 40) return 'medium';
    return 'low';
  };

  return (
    <div className="space-y-8">
      {Object.entries(groupedBySite).map(([site, siteLocations]) => (
        <div key={site} className="space-y-4">
          {/* Site header */}
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-lg font-semibold">{site}</h2>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                <span>{siteTotals[site]?.batches ?? 0} batches</span>
              </div>
              <div className="flex items-center gap-1">
                <Sprout className="h-4 w-4" />
                <span>{(siteTotals[site]?.plants ?? 0).toLocaleString()} plants</span>
              </div>
            </div>
          </div>

          {/* Location blocks in a grid layout */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {siteLocations.map((location) => {
              const capacityLevel = getCapacityLevel(location);
              
              return (
                <button
                  key={location.id}
                  onClick={() => onSelectLocation(location)}
                  className={cn(
                    'relative p-4 rounded-xl border-2 transition-all cursor-pointer text-left',
                    getTypeColor(location.type),
                    'focus:outline-none focus:ring-2 focus:ring-primary/60'
                  )}
                >
                  {/* Capacity indicator dot */}
                  <div
                    className={cn(
                      'absolute top-2 right-2 h-2.5 w-2.5 rounded-full',
                      capacityLevel === 'high' && 'bg-red-500',
                      capacityLevel === 'medium' && 'bg-amber-500',
                      capacityLevel === 'low' && 'bg-emerald-500',
                      capacityLevel === 'empty' && 'bg-gray-300'
                    )}
                    title={
                      capacityLevel === 'high' ? 'High capacity' :
                      capacityLevel === 'medium' ? 'Medium capacity' :
                      capacityLevel === 'low' ? 'Low capacity' : 'Empty'
                    }
                  />

                  {/* Location name */}
                  <div className="font-semibold text-sm truncate pr-4">
                    {location.name}
                  </div>

                  {/* Type indicator */}
                  <div className="text-xs text-muted-foreground truncate">
                    {location.type || 'Section'}
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="font-mono">{location.batchCount} B</span>
                    <span className="font-mono">{location.totalQuantity.toLocaleString()} P</span>
                  </div>

                  {/* Covered indicator */}
                  {location.covered && (
                    <div className="absolute bottom-2 left-2 text-xs opacity-60">
                      🏠
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span>Low usage</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-500" />
          <span>Medium usage</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span>High usage</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-gray-300" />
          <span>Empty</span>
        </div>
      </div>

      {locations.length === 0 && (
        <div className="text-center py-20">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Locations Found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search or filters.
          </p>
        </div>
      )}
    </div>
  );
}





