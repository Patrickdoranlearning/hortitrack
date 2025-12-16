'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import type { DeliveryZone } from '@/lib/targeting/types';
import { cn } from '@/lib/utils';

interface DeliveryZoneCardsProps {
  zones: DeliveryZone[];
  selectedZone: string | null;
  onZoneSelect: (routingKey: string | null) => void;
}

// Van capacity threshold
const VAN_CAPACITY = 10;

function getLoadStatus(trolleys: number): { label: string; color: string; bg: string } {
  const percentage = (trolleys / VAN_CAPACITY) * 100;
  if (percentage >= 80) {
    return { label: 'Nearly Full', color: 'text-green-700', bg: 'bg-green-100' };
  }
  if (percentage >= 50) {
    return { label: 'Half Full', color: 'text-amber-700', bg: 'bg-amber-100' };
  }
  return { label: 'Space Available', color: 'text-red-700', bg: 'bg-red-100' };
}

export function DeliveryZoneCards({ zones, selectedZone, onZoneSelect }: DeliveryZoneCardsProps) {
  if (zones.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 bg-slate-50 border border-dashed rounded-lg">
        <div className="text-center">
          <Truck className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No active delivery routes this week</p>
        </div>
      </div>
    );
  }

  // Group zones by date
  const zonesByDate = zones.reduce((acc, zone) => {
    const date = zone.requested_delivery_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(zone);
    return acc;
  }, {} as Record<string, DeliveryZone[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Active Delivery Zones</h3>
        {selectedZone && (
          <button
            onClick={() => onZoneSelect(null)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="space-y-3">
        {Object.entries(zonesByDate)
          .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
          .map(([date, dateZones]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">
                  {format(new Date(date), 'EEEE, MMM d')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {dateZones.map((zone) => {
                  const loadStatus = getLoadStatus(zone.total_trolleys);
                  const isSelected = selectedZone === zone.routing_key;

                  return (
                    <Card
                      key={`${zone.routing_key}-${zone.requested_delivery_date}`}
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-md',
                        isSelected
                          ? 'ring-2 ring-green-500 shadow-md'
                          : 'hover:ring-1 hover:ring-slate-200'
                      )}
                      onClick={() => onZoneSelect(isSelected ? null : zone.routing_key)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm truncate">
                              {zone.zone_name || zone.county}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {zone.routing_key}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('text-xs shrink-0', loadStatus.bg, loadStatus.color)}
                          >
                            {zone.total_trolleys}/{VAN_CAPACITY}
                          </Badge>
                        </div>

                        {/* Load bar */}
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              zone.total_trolleys >= VAN_CAPACITY * 0.8 && 'bg-green-500',
                              zone.total_trolleys >= VAN_CAPACITY * 0.5 && zone.total_trolleys < VAN_CAPACITY * 0.8 && 'bg-amber-500',
                              zone.total_trolleys < VAN_CAPACITY * 0.5 && 'bg-red-500'
                            )}
                            style={{ width: `${Math.min((zone.total_trolleys / VAN_CAPACITY) * 100, 100)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {zone.order_count} orders
                          </span>
                          <span className={loadStatus.color}>
                            {loadStatus.label}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
