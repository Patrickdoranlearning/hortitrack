'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Map, List, RefreshCw, Route, X, Navigation, Trash2 } from 'lucide-react';
import { DeliveryZoneCards } from './DeliveryZoneCards';
import { SmartTargetCard } from './SmartTargetCard';
import { TargetFilters, type FilterOption } from './TargetFilters';
import { TargetMap } from './TargetMap';
import type { SmartTarget, DeliveryZone, ScheduledDelivery } from '@/lib/targeting/types';
import { getProbabilityColor } from '@/lib/targeting/types';
import {
  optimizeRoute,
  calculateRouteDistance,
  estimateDrivingTime,
  formatDrivingTime,
  generateGoogleMapsUrl,
  type RouteStop,
} from '@/lib/targeting/routeOptimization';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'map';

interface TargetsClientProps {
  targets: SmartTarget[];
  zones: DeliveryZone[];
  scheduledDeliveries: ScheduledDelivery[];
}

export function TargetsClient({ targets, zones, scheduledDeliveries }: TargetsClientProps) {
  // Default to map view for route-focused sales targeting
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('all');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Route building state
  const [routeTargets, setRouteTargets] = useState<SmartTarget[]>([]);
  const [showRoutePanel, setShowRoutePanel] = useState(false);

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<FilterOption, number> = {
      all: targets.length,
      route_match: 0,
      nearby_route: 0,
      likely_to_order: 0,
      churn_risk: 0,
      new_customer: 0,
      routine: 0,
    };

    targets.forEach((t) => {
      counts[t.target_reason]++;
    });

    return counts;
  }, [targets]);

  // Filter targets based on selected filter and zone
  const filteredTargets = useMemo(() => {
    let result = targets;

    // Apply reason filter
    if (selectedFilter !== 'all') {
      result = result.filter((t) => t.target_reason === selectedFilter);
    }

    // Apply zone filter
    if (selectedZone) {
      result = result.filter((t) => t.routing_key === selectedZone);
    }

    return result;
  }, [targets, selectedFilter, selectedZone]);

  // Handle zone selection - also filter to route_match if selecting a zone
  const handleZoneSelect = (routingKey: string | null) => {
    setSelectedZone(routingKey);
    if (routingKey) {
      // When selecting a zone, switch to route_match filter if there are matches
      const routeMatches = targets.filter(
        (t) => t.routing_key === routingKey && t.target_reason === 'route_match'
      );
      if (routeMatches.length > 0) {
        setSelectedFilter('route_match');
      }
    }
  };

  // Handle target selection from map
  const handleTargetSelect = (target: SmartTarget | null) => {
    setSelectedTargetId(target?.customer_id || null);
  };

  // Route building functions
  const handleAddToRoute = (target: SmartTarget) => {
    if (!routeTargets.some(t => t.customer_id === target.customer_id)) {
      setRouteTargets(prev => [...prev, target]);
      setShowRoutePanel(true);
    }
  };

  const handleRemoveFromRoute = (customerId: string) => {
    setRouteTargets(prev => prev.filter(t => t.customer_id !== customerId));
  };

  const handleClearRoute = () => {
    setRouteTargets([]);
    setShowRoutePanel(false);
  };

  const handleOptimizeRoute = () => {
    const stopsForOptimization: (RouteStop & SmartTarget)[] = routeTargets
      .filter(t => t.lat != null && t.lng != null)
      .map(t => ({
        ...t,
        id: t.customer_id,
        lat: t.lat!,
        lng: t.lng!,
        name: t.customer_name,
      }));

    const optimized = optimizeRoute(stopsForOptimization);
    setRouteTargets(optimized);
  };

  const handleOpenInGoogleMaps = () => {
    const stops: RouteStop[] = routeTargets
      .filter(t => t.lat != null && t.lng != null)
      .map(t => ({
        id: t.customer_id,
        lat: t.lat!,
        lng: t.lng!,
        name: t.customer_name,
      }));

    const url = generateGoogleMapsUrl(stops);
    if (url) {
      window.open(url, '_blank');
    }
  };

  // Calculate route stats
  const routeStats = useMemo(() => {
    const validStops = routeTargets.filter(t => t.lat != null && t.lng != null);
    if (validStops.length < 2) return null;

    const stops: RouteStop[] = validStops.map(t => ({
      id: t.customer_id,
      lat: t.lat!,
      lng: t.lng!,
      name: t.customer_name,
    }));

    const distance = calculateRouteDistance(stops);
    const drivingMinutes = estimateDrivingTime(distance);

    return {
      distance,
      drivingTime: formatDrivingTime(drivingMinutes),
      stopCount: validStops.length,
    };
  }, [routeTargets]);

  return (
    <div className="space-y-6">
      {/* Delivery Zone Cards */}
      <DeliveryZoneCards
        zones={zones}
        selectedZone={selectedZone}
        onZoneSelect={handleZoneSelect}
      />

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filters */}
        <TargetFilters
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
          counts={filterCounts}
        />

        {/* View Toggle & Route Button */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            {filteredTargets.length} customers
          </span>

          {/* Route button */}
          {routeTargets.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setShowRoutePanel(!showRoutePanel)}
            >
              <Route className="h-4 w-4" />
              Route ({routeTargets.length})
            </Button>
          )}

          {/* View toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('map')}
              className={cn(
                'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                viewMode === 'map'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              <Map className="h-4 w-4" />
              Map
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                viewMode === 'list'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Route Planning Panel */}
      {showRoutePanel && routeTargets.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Route className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-indigo-900">Your Route</h3>
                {routeStats && (
                  <span className="text-sm text-indigo-600">
                    {routeStats.stopCount} stops • {routeStats.distance} km • {routeStats.drivingTime}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowRoutePanel(false)}
                className="p-1 hover:bg-indigo-100 rounded"
              >
                <X className="h-4 w-4 text-indigo-600" />
              </button>
            </div>

            {/* Route stops list */}
            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
              {routeTargets.map((target, index) => (
                <div
                  key={target.customer_id}
                  className="flex items-center gap-2 bg-white rounded p-2"
                >
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{target.customer_name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span
                        className="font-medium"
                        style={{ color: getProbabilityColor(target.probability_score) }}
                      >
                        {target.probability_score}%
                      </span>
                      <span>{target.zone_name || target.county}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFromRoute(target.customer_id)}
                    className="p-1 hover:bg-red-100 rounded text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Route actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOptimizeRoute}
                disabled={routeTargets.length < 3}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Optimize Order
              </Button>
              <Button
                size="sm"
                onClick={handleOpenInGoogleMaps}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Navigation className="h-4 w-4 mr-1" />
                Open in Maps
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearRoute}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {viewMode === 'map' ? (
        <div className="h-[calc(100vh-300px)] min-h-[400px] rounded-lg overflow-hidden border">
          <TargetMap
            targets={filteredTargets}
            scheduledDeliveries={scheduledDeliveries}
            onTargetSelect={handleTargetSelect}
            selectedTargetId={selectedTargetId}
            onAddToRoute={handleAddToRoute}
            selectedRouteTargets={routeTargets}
          />
        </div>
      ) : (
        <div>
          {filteredTargets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-50 border border-dashed rounded-lg text-center">
              <List className="h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900">No Targets Found</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">
                {selectedZone || selectedFilter !== 'all'
                  ? 'Try adjusting your filters to see more targets.'
                  : 'No customers to target right now. Check back when there are active delivery runs.'}
              </p>
              {(selectedZone || selectedFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSelectedZone(null);
                    setSelectedFilter('all');
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTargets.map((target) => (
                <SmartTargetCard
                  key={target.customer_id}
                  target={target}
                  showScoreBreakdown
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
