'use client';

import * as React from 'react';
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export type DashboardFilters = {
  statuses: string[];
  families: string[];
  locations: string[];
  varieties: string[];
  dateFrom: string | null;
  dateTo: string | null;
};

type FilterContextValue = {
  filters: DashboardFilters;
  setFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  toggleFilter: (key: 'statuses' | 'families' | 'locations' | 'varieties', value: string) => void;
  clearFilters: () => void;
  clearFilter: (key: keyof DashboardFilters) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
};

const defaultFilters: DashboardFilters = {
  statuses: [],
  families: [],
  locations: [],
  varieties: [],
  dateFrom: null,
  dateTo: null,
};

const DashboardFilterContext = createContext<FilterContextValue | null>(null);

export function DashboardFilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize filters from URL
  const initialFilters = useMemo((): DashboardFilters => {
    const statuses = searchParams.get('statuses')?.split(',').filter(Boolean) ?? [];
    const families = searchParams.get('families')?.split(',').filter(Boolean) ?? [];
    const locations = searchParams.get('locations')?.split(',').filter(Boolean) ?? [];
    const varieties = searchParams.get('varieties')?.split(',').filter(Boolean) ?? [];
    const dateFrom = searchParams.get('dateFrom') ?? null;
    const dateTo = searchParams.get('dateTo') ?? null;

    return { statuses, families, locations, varieties, dateFrom, dateTo };
  }, [searchParams]);

  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);

  // Sync filters to URL
  const syncToUrl = useCallback((newFilters: DashboardFilters) => {
    const params = new URLSearchParams();
    
    if (newFilters.statuses.length > 0) {
      params.set('statuses', newFilters.statuses.join(','));
    }
    if (newFilters.families.length > 0) {
      params.set('families', newFilters.families.join(','));
    }
    if (newFilters.locations.length > 0) {
      params.set('locations', newFilters.locations.join(','));
    }
    if (newFilters.varieties.length > 0) {
      params.set('varieties', newFilters.varieties.join(','));
    }
    if (newFilters.dateFrom) {
      params.set('dateFrom', newFilters.dateFrom);
    }
    if (newFilters.dateTo) {
      params.set('dateTo', newFilters.dateTo);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [pathname, router]);

  const setFilter = useCallback(<K extends keyof DashboardFilters>(
    key: K, 
    value: DashboardFilters[K]
  ) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      syncToUrl(next);
      return next;
    });
  }, [syncToUrl]);

  const toggleFilter = useCallback((
    key: 'statuses' | 'families' | 'locations' | 'varieties',
    value: string
  ) => {
    setFilters(prev => {
      const current = prev[key];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      const newFilters = { ...prev, [key]: next };
      syncToUrl(newFilters);
      return newFilters;
    });
  }, [syncToUrl]);

  const clearFilter = useCallback((key: keyof DashboardFilters) => {
    setFilters(prev => {
      const next = { 
        ...prev, 
        [key]: Array.isArray(prev[key]) ? [] : null 
      };
      syncToUrl(next);
      return next;
    });
  }, [syncToUrl]);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.statuses.length > 0 ||
      filters.families.length > 0 ||
      filters.locations.length > 0 ||
      filters.varieties.length > 0 ||
      filters.dateFrom !== null ||
      filters.dateTo !== null
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.statuses.length > 0) count++;
    if (filters.families.length > 0) count++;
    if (filters.locations.length > 0) count++;
    if (filters.varieties.length > 0) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    return count;
  }, [filters]);

  const value: FilterContextValue = {
    filters,
    setFilter,
    toggleFilter,
    clearFilters,
    clearFilter,
    hasActiveFilters,
    activeFilterCount,
  };

  return (
    <DashboardFilterContext.Provider value={value}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilters() {
  const context = useContext(DashboardFilterContext);
  if (!context) {
    throw new Error('useDashboardFilters must be used within DashboardFilterProvider');
  }
  return context;
}

// Hook to filter data based on current filters
export function useFilteredData<T extends Record<string, unknown>>(
  data: T[],
  config: {
    statusField?: keyof T;
    familyField?: keyof T;
    locationField?: keyof T;
    varietyField?: keyof T;
    dateField?: keyof T;
  }
): T[] {
  const { filters } = useDashboardFilters();

  return useMemo(() => {
    return data.filter(item => {
      // Status filter
      if (filters.statuses.length > 0 && config.statusField) {
        const itemStatus = item[config.statusField] as string;
        if (!filters.statuses.includes(itemStatus)) return false;
      }

      // Family filter
      if (filters.families.length > 0 && config.familyField) {
        const itemFamily = item[config.familyField] as string;
        if (!filters.families.includes(itemFamily)) return false;
      }

      // Location filter
      if (filters.locations.length > 0 && config.locationField) {
        const itemLocation = item[config.locationField] as string;
        if (!filters.locations.includes(itemLocation)) return false;
      }

      // Variety filter
      if (filters.varieties.length > 0 && config.varietyField) {
        const itemVariety = item[config.varietyField] as string;
        if (!filters.varieties.includes(itemVariety)) return false;
      }

      // Date filter
      if ((filters.dateFrom || filters.dateTo) && config.dateField) {
        const itemDate = item[config.dateField] as string | null;
        if (!itemDate) return false;
        
        if (filters.dateFrom && itemDate < filters.dateFrom) return false;
        if (filters.dateTo && itemDate > filters.dateTo) return false;
      }

      return true;
    });
  }, [data, filters, config]);
}

