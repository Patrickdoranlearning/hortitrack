'use client';

import * as React from 'react';
import { Suspense, useMemo, useState, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sprout,
  Package,
  TrendingDown,
  ShoppingCart,
  Leaf,
  X,
  Filter,
  MapPin,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { PageFrame } from '@/ui/templates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import nextDynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

// SWR fetcher that returns data directly
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch dashboard data');
    throw error;
  }
  return res.json();
};
import type { ProductionDashboardData } from '@/app/api/production/dashboard/route';

// Dynamic imports for charts
const PipelineFunnel = nextDynamic(
  () => import('@/components/charts/PipelineFunnel'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

const VarietyTreemap = nextDynamic(
  () => import('@/components/charts/VarietyTreemap'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

const LocationGrid = nextDynamic(
  () => import('@/components/charts/LocationGrid'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

const LossTrendChart = nextDynamic(
  () => import('@/components/charts/LossTrendChart'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

const BatchAgeHistogram = nextDynamic(
  () => import('@/components/charts/BatchAgeHistogram'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

const AvailabilityDonut = nextDynamic(
  () => import('@/components/charts/AvailabilityDonut'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

const BatchTable = nextDynamic(
  () => import('@/components/production/dashboard/BatchTable'),
  { ssr: false, loading: () => <Skeleton className="h-[400px] w-full" /> }
);

export const dynamic = "force-dynamic";

// Filter types
type Filters = {
  statuses: string[];
  families: string[];
  locations: string[];
};

export default function ProductionDashboard() {
  // Fetch dashboard data
  const { data, isLoading, error, mutate } = useSWR<ProductionDashboardData>(
    '/api/production/dashboard',
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
    }
  );

  // Filter state
  const [filters, setFilters] = useState<Filters>({
    statuses: [],
    families: [],
    locations: [],
  });

  // Toggle filter value
  const toggleFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters(prev => {
      const current = prev[key];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({ statuses: [], families: [], locations: [] });
  }, []);

  // Check if any filters are active
  const hasActiveFilters = filters.statuses.length > 0 || 
    filters.families.length > 0 || 
    filters.locations.length > 0;

  // Filter batch data
  const filteredBatches = useMemo(() => {
    if (!data?.batches || !Array.isArray(data.batches)) return [];
    
    return data.batches.filter(batch => {
      if (filters.statuses.length > 0 && !filters.statuses.includes(batch.status)) {
        return false;
      }
      if (filters.families.length > 0 && !filters.families.includes(batch.family)) {
        return false;
      }
      if (filters.locations.length > 0 && !filters.locations.includes(batch.locationId)) {
        return false;
      }
      return true;
    });
  }, [data?.batches, filters]);

  // Calculate filtered totals
  const filteredTotals = useMemo(() => {
    const defaultTotals = {
      totalPlants: 0,
      availablePlants: 0,
      growingPlants: 0,
      reservedPlants: 0,
      lossLast30Days: 0,
      lossPercentage: 0,
    };

    if (!hasActiveFilters) {
      return data?.totals ?? defaultTotals;
    }

    let total = 0;
    let available = 0;
    let reserved = 0;

    for (const batch of filteredBatches) {
      total += batch.quantity;
      available += batch.available;
      reserved += batch.reserved;
    }

    return {
      totalPlants: total,
      availablePlants: available,
      growingPlants: total - available,
      reservedPlants: reserved,
      lossLast30Days: data?.totals?.lossLast30Days ?? 0,
      lossPercentage: data?.totals?.lossPercentage ?? 0,
    };
  }, [data?.totals, filteredBatches, hasActiveFilters]);

  // Get unique filter options
  const filterOptions = useMemo(() => {
    if (!data) return { statuses: [], families: [], locations: [] };

    return {
      statuses: [...new Set((data.byStatus ?? []).map(s => s.status))],
      families: [...new Set((data.byFamily ?? []).map(f => f.family))],
      locations: (data.byLocation ?? []).map(l => ({ id: l.locationId, name: l.locationName })),
    };
  }, [data]);

  // Loading state
  if (isLoading) {
    return (
      <PageFrame moduleKey="production">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-headline tracking-tight">Production Dashboard</h1>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </PageFrame>
    );
  }

  // Error state
  if (error) {
    return (
      <PageFrame moduleKey="production">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <p className="text-destructive">Failed to load dashboard data</p>
          <Button onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-headline tracking-tight">Production Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Real-time snapshot of your production pipeline
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => mutate()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filters:</span>
            {filters.statuses.map(status => (
              <Badge
                key={status}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => toggleFilter('statuses', status)}
              >
                {status}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
            {filters.families.map(family => (
              <Badge
                key={family}
                variant="secondary"
                className="cursor-pointer bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                onClick={() => toggleFilter('families', family)}
              >
                {family}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
            {filters.locations.map(locId => {
              const loc = filterOptions.locations.find(l => l.id === locId);
              return (
                <Badge
                  key={locId}
                  variant="secondary"
                  className="cursor-pointer bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  onClick={() => toggleFilter('locations', locId)}
                >
                  {loc?.name ?? locId}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              );
            })}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          </div>
        )}

        {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Plants</CardTitle>
              <Sprout className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                {filteredTotals.totalPlants.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                {filteredBatches.length} active batches
                  </p>
                </CardContent>
              </Card>

          <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                Available for Sale
                  </CardTitle>
              <ShoppingCart className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {filteredTotals.availablePlants.toLocaleString()}
              </div>
                  <p className="text-xs text-muted-foreground">
                Ready to ship
                  </p>
                </CardContent>
              </Card>

          <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
                In Production
                  </CardTitle>
              <Leaf className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {filteredTotals.growingPlants.toLocaleString()}
              </div>
                  <p className="text-xs text-muted-foreground">
                {filteredTotals.reservedPlants.toLocaleString()} reserved
                  </p>
                </CardContent>
              </Card>

          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
                Loss (30 days)
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {(data?.totals?.lossLast30Days ?? 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {data?.totals?.lossPercentage ?? 0}% of production
              </p>
            </CardContent>
          </Card>
            </div>

        {/* Charts Row 1 */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Pipeline Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Production Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {data?.byStatus && data.byStatus.length > 0 ? (
                  <PipelineFunnel
                    data={data.byStatus}
                    activeStatuses={filters.statuses}
                    onSegmentClick={(status) => toggleFilter('statuses', status)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Variety Treemap */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Leaf className="h-4 w-4" />
                Variety Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {data?.byVariety && data.byVariety.length > 0 ? (
                  <VarietyTreemap
                    data={data.byVariety}
                    activeFamilies={filters.families}
                    onFamilyClick={(family) => toggleFilter('families', family)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Location Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Location Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {data?.byLocation && data.byLocation.length > 0 ? (
                  <LocationGrid
                    data={data.byLocation}
                    activeLocations={filters.locations}
                    onLocationClick={(locId) => toggleFilter('locations', locId)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Loss Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-4 w-4" />
                Loss Trend (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <LossTrendChart data={data?.lossTimeline ?? []} days={30} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 3 */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Batch Age Histogram */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Batch Age Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {data?.byAge && data.byAge.length > 0 ? (
                  <BatchAgeHistogram data={data.byAge} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Availability Donut */}
          <Card>
                <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" />
                Availability Breakdown
                  </CardTitle>
                </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <AvailabilityDonut
                  available={filteredTotals.availablePlants}
                  reserved={filteredTotals.reservedPlants}
                  growing={filteredTotals.growingPlants - filteredTotals.reservedPlants}
                />
                  </div>
                </CardContent>
              </Card>
            </div>

        {/* Batch Table */}
            <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Batch Details
              </span>
              {hasActiveFilters && (
                <span className="text-sm font-normal text-muted-foreground">
                  Showing {filteredBatches.length} of {data?.batches?.length ?? 0} batches
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BatchTable data={filteredBatches} pageSize={15} />
              </CardContent>
            </Card>
      </div>
    </PageFrame>
  );
}
