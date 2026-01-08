'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Map, List, RefreshCw } from 'lucide-react';
import { DeliveryZoneCards } from './DeliveryZoneCards';
import { SmartTargetCard } from './SmartTargetCard';
import { TargetFilters, type FilterOption } from './TargetFilters';
import { TargetMap } from './TargetMap';
import type { SmartTarget, DeliveryZone, ScheduledDelivery, TargetReason } from '@/lib/targeting/types';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'map';

interface TargetsClientProps {
  targets: SmartTarget[];
  zones: DeliveryZone[];
  scheduledDeliveries: ScheduledDelivery[];
}

export function TargetsClient({ targets, zones, scheduledDeliveries }: TargetsClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('all');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

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

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            {filteredTargets.length} customers
          </span>
          <div className="flex items-center border rounded-lg overflow-hidden">
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'list' ? (
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
      ) : (
        <div className="h-[600px] rounded-lg overflow-hidden border">
          <TargetMap
            targets={filteredTargets}
            scheduledDeliveries={scheduledDeliveries}
            onTargetSelect={handleTargetSelect}
            selectedTargetId={selectedTargetId}
          />
        </div>
      )}
    </div>
  );
}
