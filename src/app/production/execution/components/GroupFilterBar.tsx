"use client";

import * as React from "react";
import { X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlanningBatch } from "@/lib/planning/types";
import type { FilterCriteria } from "@/server/production/execution-groups";

type Props = {
  batches: PlanningBatch[];
  filters?: Partial<FilterCriteria>;
  onChange: (filters: Partial<FilterCriteria>) => void;
};

export function GroupFilterBar({ batches, filters, onChange }: Props) {
  // Extract unique values from batches for filter options
  const uniqueSuppliers = React.useMemo(() => {
    const suppliers = new Map<string, string>();
    for (const batch of batches) {
      if (batch.supplierId && batch.supplierName) {
        suppliers.set(batch.supplierId, batch.supplierName);
      }
    }
    return Array.from(suppliers.entries()).map(([id, name]) => ({ id, name }));
  }, [batches]);

  const uniqueSizes = React.useMemo(() => {
    const sizes = new Map<string, string>();
    for (const batch of batches) {
      if (batch.sizeId && batch.sizeName) {
        sizes.set(batch.sizeId, batch.sizeName);
      }
    }
    return Array.from(sizes.entries()).map(([id, name]) => ({ id, name }));
  }, [batches]);

  const uniqueWeeks = React.useMemo(() => {
    const weeks = new Set<number>();
    for (const batch of batches) {
      if (batch.readyDate) {
        const date = new Date(batch.readyDate);
        const week = getWeekNumber(date);
        weeks.add(week);
      }
    }
    return Array.from(weeks).sort((a, b) => a - b);
  }, [batches]);

  const hasFilters =
    (filters?.supplierIds?.length ?? 0) > 0 ||
    (filters?.sizeIds?.length ?? 0) > 0 ||
    filters?.weekRange?.from !== undefined ||
    filters?.weekRange?.to !== undefined;

  const handleSupplierChange = (value: string) => {
    if (value === "__all__") {
      const { supplierIds: _supplierIds, ...rest } = filters ?? {};
      onChange(rest);
    } else {
      onChange({ ...filters, supplierIds: [value] });
    }
  };

  const handleSizeChange = (value: string) => {
    if (value === "__all__") {
      const { sizeIds: _sizeIds, ...rest } = filters ?? {};
      onChange(rest);
    } else {
      onChange({ ...filters, sizeIds: [value] });
    }
  };

  const handleWeekChange = (value: string) => {
    if (value === "__all__") {
      const { weekRange: _weekRange, ...rest } = filters ?? {};
      onChange(rest);
    } else {
      const week = parseInt(value, 10);
      onChange({ ...filters, weekRange: { from: week, to: week } });
    }
  };

  const clearFilters = () => {
    onChange({});
  };

  // Don't show filter bar if no meaningful filter options
  if (uniqueSuppliers.length <= 1 && uniqueSizes.length <= 1 && uniqueWeeks.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 border-b">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Filter:</span>

      {/* Supplier filter */}
      {uniqueSuppliers.length > 1 && (
        <Select
          value={filters?.supplierIds?.[0] ?? "__all__"}
          onValueChange={handleSupplierChange}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All suppliers</SelectItem>
            {uniqueSuppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Size filter */}
      {uniqueSizes.length > 1 && (
        <Select
          value={filters?.sizeIds?.[0] ?? "__all__"}
          onValueChange={handleSizeChange}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All sizes</SelectItem>
            {uniqueSizes.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Week filter */}
      {uniqueWeeks.length > 1 && (
        <Select
          value={
            filters?.weekRange?.from !== undefined
              ? String(filters.weekRange.from)
              : "__all__"
          }
          onValueChange={handleWeekChange}
        >
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue placeholder="Week" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All weeks</SelectItem>
            {uniqueWeeks.map((w) => (
              <SelectItem key={w} value={String(w)}>
                Week {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Clear filters button */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={clearFilters}
        >
          <X className="mr-1 h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}

// Helper function to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
