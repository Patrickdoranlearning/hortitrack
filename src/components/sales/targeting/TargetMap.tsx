'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Plus, MapPin, X, Navigation, TrendingUp } from 'lucide-react';
import type { SmartTarget, ScheduledDelivery } from '@/lib/targeting/types';
import { formatDaysSinceOrder, getProbabilityColor, getProbabilityLabel } from '@/lib/targeting/types';
import { cn } from '@/lib/utils';

// Ireland center coordinates
const IRELAND_CENTER: [number, number] = [53.4129, -7.6921];
const DEFAULT_ZOOM = 7;

interface TargetMapProps {
  targets: SmartTarget[];
  scheduledDeliveries: ScheduledDelivery[];
  onTargetSelect?: (target: SmartTarget | null) => void;
  selectedTargetId?: string | null;
  onAddToRoute?: (target: SmartTarget) => void;
  selectedRouteTargets?: SmartTarget[];
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

export function TargetMap({
  targets,
  scheduledDeliveries,
  onTargetSelect,
  selectedTargetId,
  onAddToRoute,
  selectedRouteTargets = [],
}: TargetMapProps) {
  const router = useRouter();
  const [selectedTarget, setSelectedTarget] = useState<SmartTarget | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Prevent React 18 Strict Mode double-render from causing Leaflet issues
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Filter to only items with valid coordinates
  const mappableTargets = targets.filter(t => t.lat && t.lng);
  const mappableDeliveries = scheduledDeliveries.filter(d => d.lat && d.lng);

  const handleTargetClick = (target: SmartTarget) => {
    setSelectedTarget(target);
    onTargetSelect?.(target);
  };

  const handleClose = () => {
    setSelectedTarget(null);
    onTargetSelect?.(null);
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

  const handleOpenInMaps = () => {
    if (!selectedTarget?.lat || !selectedTarget?.lng) return;
    // Open in Google Maps (works on mobile and desktop)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedTarget.lat},${selectedTarget.lng}`;
    window.open(url, '_blank');
  };

  const isInRoute = selectedTarget
    ? selectedRouteTargets.some(t => t.customer_id === selectedTarget.customer_id)
    : false;

  // Show loading state until mounted (prevents React 18 Strict Mode issues with Leaflet)
  if (!isMounted) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center rounded-lg">
        <div className="text-slate-500">Loading map...</div>
      </div>
    );
  }

  if (mappableTargets.length === 0 && mappableDeliveries.length === 0) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center rounded-lg">
        <div className="text-center p-4">
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
      />

      {/* Legend - Responsive positioning */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000] max-w-[200px]">
        <div className="text-xs font-semibold text-slate-700 mb-2">Legend</div>
        <div className="space-y-1.5">
          {/* Scheduled delivery */}
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-red-800" />
            <span className="text-slate-600">Scheduled Delivery</span>
          </div>
          {/* Route line */}
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-0.5 bg-indigo-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-slate-600">Delivery Route</span>
          </div>
          <div className="border-t border-slate-200 my-1.5" />
          {/* Probability tiers */}
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-green-600" />
            <span className="text-slate-600">High (70%+)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-slate-600">Medium (40-69%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-slate-600">Low (&lt;40%)</span>
          </div>
          <div className="border-t border-slate-200 my-1.5" />
          {/* Size indicator */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-0.5">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <div className="w-3 h-3 rounded-full bg-slate-400" />
            </div>
            <span>Size = Value</span>
          </div>
        </div>
      </div>

      {/* Selected Target Info Card - Mobile-optimized */}
      {selectedTarget && (
        <div className={cn(
          "absolute z-[1000]",
          // Mobile: bottom sheet style
          "bottom-0 left-0 right-0 sm:bottom-auto sm:left-auto",
          // Desktop: top-right card
          "sm:top-4 sm:right-4 sm:w-80"
        )}>
          <Card className="shadow-lg rounded-t-xl sm:rounded-xl">
            <CardContent className="p-4">
              {/* Header with close button */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-base sm:text-sm">{selectedTarget.customer_name}</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <MapPin className="h-3 w-3" />
                    {selectedTarget.zone_name || selectedTarget.county}
                    {selectedTarget.routing_key && (
                      <span className="text-slate-400">({selectedTarget.routing_key})</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              {/* Probability Score - Prominent display */}
              <div
                className="flex items-center gap-3 p-3 rounded-lg mb-3"
                style={{
                  backgroundColor: `${getProbabilityColor(selectedTarget.probability_score)}15`,
                }}
              >
                <div
                  className="text-3xl font-bold"
                  style={{ color: getProbabilityColor(selectedTarget.probability_score) }}
                >
                  {selectedTarget.probability_score}%
                </div>
                <div className="flex-1">
                  <div
                    className="text-sm font-medium"
                    style={{ color: getProbabilityColor(selectedTarget.probability_score) }}
                  >
                    {getProbabilityLabel(selectedTarget.probability_score)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Route Fit: {selectedTarget.route_fit_score}
                  </div>
                </div>
                <TrendingUp
                  className="h-6 w-6"
                  style={{ color: getProbabilityColor(selectedTarget.probability_score) }}
                />
              </div>

              {/* Context note */}
              <p className="text-sm text-slate-600 mb-3 italic">{selectedTarget.context_note}</p>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
                <div className="bg-slate-50 rounded p-2">
                  <div className="font-semibold text-slate-900">{selectedTarget.total_orders || 0}</div>
                  <div className="text-slate-500">Orders</div>
                </div>
                <div className="bg-slate-50 rounded p-2">
                  <div className="font-semibold text-slate-900">
                    {selectedTarget.avg_order_value ? `€${Math.round(selectedTarget.avg_order_value)}` : '-'}
                  </div>
                  <div className="text-slate-500">Avg Value</div>
                </div>
                <div className="bg-slate-50 rounded p-2">
                  <div className="font-semibold text-slate-900">
                    {formatDaysSinceOrder(selectedTarget.last_order_at)}
                  </div>
                  <div className="text-slate-500">Last Order</div>
                </div>
              </div>

              {/* Contact button - Large for mobile */}
              {selectedTarget.phone && (
                <a
                  href={`tel:${selectedTarget.phone}`}
                  className="flex items-center justify-center gap-2 w-full py-3 mb-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Phone className="h-5 w-5" />
                  Call {selectedTarget.phone}
                </a>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={handleOpenInMaps}
                >
                  <Navigation className="h-4 w-4" />
                  Navigate
                </Button>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={handleCreateOrder}
                >
                  <Plus className="h-4 w-4" />
                  Create Order
                </Button>
              </div>

              {/* Add to Route button */}
              {onAddToRoute && (
                <Button
                  variant={isInRoute ? "secondary" : "outline"}
                  size="sm"
                  className="w-full mt-2 gap-1"
                  onClick={() => onAddToRoute(selectedTarget)}
                  disabled={isInRoute}
                >
                  {isInRoute ? '✓ Added to Route' : '+ Add to Route'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
