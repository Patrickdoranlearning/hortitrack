'use client';

import { Badge } from '@/components/ui/badge';
import {
  Truck,
  AlertTriangle,
  UserPlus,
  TrendingUp,
  Route,
  Target,
} from 'lucide-react';
import type { TargetReason } from '@/lib/targeting/types';
import { cn } from '@/lib/utils';

export type FilterOption = TargetReason | 'all';

interface TargetFiltersProps {
  selectedFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  counts: Record<FilterOption, number>;
}

const FILTER_OPTIONS: {
  value: FilterOption;
  label: string;
  icon: typeof Target;
  activeClass: string;
}[] = [
  {
    value: 'all',
    label: 'All',
    icon: Target,
    activeClass: 'bg-slate-900 text-white border-slate-900',
  },
  {
    value: 'route_match',
    label: 'Route Match',
    icon: Truck,
    activeClass: 'bg-green-600 text-white border-green-600',
  },
  {
    value: 'nearby_route',
    label: 'Nearby Route',
    icon: Route,
    activeClass: 'bg-emerald-600 text-white border-emerald-600',
  },
  {
    value: 'likely_to_order',
    label: 'Likely to Order',
    icon: TrendingUp,
    activeClass: 'bg-blue-600 text-white border-blue-600',
  },
  {
    value: 'churn_risk',
    label: 'Churn Risk',
    icon: AlertTriangle,
    activeClass: 'bg-amber-600 text-white border-amber-600',
  },
  {
    value: 'new_customer',
    label: 'New',
    icon: UserPlus,
    activeClass: 'bg-sky-600 text-white border-sky-600',
  },
];

export function TargetFilters({ selectedFilter, onFilterChange, counts }: TargetFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTER_OPTIONS.map(({ value, label, icon: Icon, activeClass }) => {
        const isActive = selectedFilter === value;
        const count = counts[value] || 0;

        // Don't show filters with 0 count (except 'all')
        if (value !== 'all' && count === 0) return null;

        return (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
              'border transition-colors',
              isActive
                ? activeClass
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            <Badge
              variant="secondary"
              className={cn(
                'ml-1 px-1.5 py-0 text-xs',
                isActive ? 'bg-white/20 text-inherit' : 'bg-slate-100'
              )}
            >
              {count}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
