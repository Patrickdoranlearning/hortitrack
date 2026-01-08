'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Plus, MapPin, Truck, AlertTriangle, TrendingUp, UserPlus, Route } from 'lucide-react';
import type { SmartTarget, ScheduledDelivery, TargetReason } from '@/lib/targeting/types';
import { formatDaysSinceOrder } from '@/lib/targeting/types';
import { cn } from '@/lib/utils';

// Ireland center coordinates
const IRELAND_CENTER: [number, number] = [53.4129, -7.6921];
const DEFAULT_ZOOM = 7;

interface TargetMapProps {
  targets: SmartTarget[];
  scheduledDeliveries: ScheduledDelivery[];
  onTargetSelect?: (target: SmartTarget | null) => void;
  selectedTargetId?: string | null;
}

// Dynamically import map components to avoid SSR issues with Leaflet
const MapWithNoSSR = dynamic(
  () => import('./MapContainer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500">Loading map...</div>
      </div>
    ),
  }
);

const REASON_COLORS: Record<TargetReason, string> = {
  route_match: '#16a34a',      // green-600
  nearby_route: '#059669',     // emerald-600
  likely_to_order: '#2563eb',  // blue-600
  churn_risk: '#d97706',       // amber-600
  new_customer: '#0284c7',     // sky-600
  routine: '#6b7280',          // gray-500
};

const REASON_ICONS: Record<TargetReason, typeof Truck> = {
  route_match: Truck,
  nearby_route: Route,
  likely_to_order: TrendingUp,
  churn_risk: AlertTriangle,
  new_customer: UserPlus,
  routine: MapPin,
};

export function TargetMap({
  targets,
  scheduledDeliveries,
  onTargetSelect,
  selectedTargetId
}: TargetMapProps) {
  const router = useRouter();
  const [selectedTarget, setSelectedTarget] = useState<SmartTarget | null>(null);

  // Filter to only items with valid coordinates
  const mappableTargets = targets.filter(t => t.lat && t.lng);
  const mappableDeliveries = scheduledDeliveries.filter(d => d.lat && d.lng);

  const handleTargetClick = (target: SmartTarget) => {
    setSelectedTarget(target);
    onTargetSelect?.(target);
  };

  const handleCreateOrder = () => {
    if (!selectedTarget) return;
    const params = new URLSearchParams();
    params.set('customerId', selectedTarget.customer_id);
    if (selectedTarget.suggested_delivery_date) {
      params.set('date', selectedTarget.suggested_delivery_date);
    }
    router.push(`/sales/orders/new?${params.toString()}`);
  };

  if (mappableTargets.length === 0 && mappableDeliveries.length === 0) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center rounded-lg">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500">No geocoded customers to display</p>
          <p className="text-sm text-slate-400 mt-1">
            Add Eircodes to customer addresses to see them on the map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <MapWithNoSSR
        targets={mappableTargets}
        scheduledDeliveries={mappableDeliveries}
        center={IRELAND_CENTER}
        zoom={DEFAULT_ZOOM}
        onTargetClick={handleTargetClick}
        selectedTargetId={selectedTargetId || selectedTarget?.customer_id}
        reasonColors={REASON_COLORS}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <div className="text-xs font-medium text-slate-700 mb-2">Legend</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-600">Scheduled Delivery</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-green-600" />
            <span className="text-slate-600">Route Match</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-emerald-600" />
            <span className="text-slate-600">Nearby Route</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-blue-600" />
            <span className="text-slate-600">Likely to Order</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-amber-600" />
            <span className="text-slate-600">Churn Risk</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-sky-600" />
            <span className="text-slate-600">New Customer</span>
          </div>
        </div>
      </div>

      {/* Selected Target Info Card */}
      {selectedTarget && (
        <div className="absolute top-4 right-4 z-[1000] w-80">
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-sm">{selectedTarget.customer_name}</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <MapPin className="h-3 w-3" />
                    {selectedTarget.zone_name || selectedTarget.county}
                    {selectedTarget.routing_key && (
                      <span className="text-slate-400">({selectedTarget.routing_key})</span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{
                    backgroundColor: `${REASON_COLORS[selectedTarget.target_reason]}15`,
                    color: REASON_COLORS[selectedTarget.target_reason],
                    borderColor: REASON_COLORS[selectedTarget.target_reason]
                  }}
                >
                  Score: {selectedTarget.priority_score}
                </Badge>
              </div>

              <p className="text-sm text-slate-600 mb-3">{selectedTarget.context_note}</p>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-3">
                <div>
                  Orders: <span className="font-medium text-slate-700">{selectedTarget.total_orders || 0}</span>
                </div>
                <div>
                  Avg: <span className="font-medium text-slate-700">
                    {selectedTarget.avg_order_value ? `€${Math.round(selectedTarget.avg_order_value)}` : '-'}
                  </span>
                </div>
                <div className="col-span-2">
                  Last: <span className="font-medium text-slate-700">
                    {formatDaysSinceOrder(selectedTarget.last_order_at)}
                  </span>
                </div>
              </div>

              {selectedTarget.phone && (
                <div className="text-xs text-slate-500 mb-3">
                  <a
                    href={`tel:${selectedTarget.phone}`}
                    className="flex items-center gap-1 hover:text-green-700"
                  >
                    <Phone className="h-3 w-3" />
                    {selectedTarget.phone}
                  </a>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedTarget(null);
                    onTargetSelect?.(null);
                  }}
                >
                  Close
                </Button>
                <Button size="sm" className="flex-1 gap-1" onClick={handleCreateOrder}>
                  <Plus className="h-3 w-3" />
                  Order
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
