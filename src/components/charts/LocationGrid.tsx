'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface LocationGridProps {
  data: {
    locationId: string;
    locationName: string;
    site: string;
    quantity: number;
    batchCount: number;
    area: number | null;
  }[];
  onLocationClick?: (locationId: string) => void;
  activeLocations?: string[];
}

export default function LocationGrid({
  data,
  onLocationClick,
  activeLocations = [],
}: LocationGridProps) {
  // Group by site
  const groupedData = useMemo(() => {
    const siteMap = new Map<string, typeof data>();
    
    for (const loc of data) {
      const site = loc.site || 'Main';
      if (!siteMap.has(site)) {
        siteMap.set(site, []);
      }
      siteMap.get(site)!.push(loc);
    }
    
    return Array.from(siteMap.entries()).map(([site, locations]) => ({
      site,
      locations: locations.sort((a, b) => b.quantity - a.quantity),
      totalQuantity: locations.reduce((sum, l) => sum + l.quantity, 0),
    }));
  }, [data]);

  // Calculate max for color scaling
  const maxQuantity = useMemo(() => {
    return Math.max(...data.map(d => d.quantity), 1);
  }, [data]);

  const getIntensity = (quantity: number) => {
    return Math.min(0.9, 0.15 + (quantity / maxQuantity) * 0.75);
  };

  const handleClick = (locationId: string) => {
    if (onLocationClick) {
      onLocationClick(locationId);
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No location data available
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full overflow-auto">
      {groupedData.map(({ site, locations, totalQuantity }) => (
        <div key={site} className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">{site}</h4>
            <span className="text-xs text-muted-foreground">
              {totalQuantity.toLocaleString()} plants
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {locations.map((loc) => {
              const isActive = activeLocations.length === 0 || activeLocations.includes(loc.locationId);
              const intensity = getIntensity(loc.quantity);
              
              return (
                <button
                  key={loc.locationId}
                  onClick={() => handleClick(loc.locationId)}
                  className={cn(
                    "relative p-3 rounded-lg border transition-all",
                    "hover:ring-2 hover:ring-primary/50",
                    isActive ? "opacity-100" : "opacity-30",
                  )}
                  style={{
                    backgroundColor: `hsl(142, 76%, 36%, ${intensity})`,
                  }}
                >
                  <div className="text-left">
                    <div className="text-xs font-medium text-foreground truncate">
                      {loc.locationName}
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      {loc.quantity.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {loc.batchCount} batch{loc.batchCount !== 1 ? 'es' : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

