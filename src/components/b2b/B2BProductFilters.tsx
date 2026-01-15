'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Search, Sparkles } from 'lucide-react';

export type ProductFilters = {
  category: string | null;
  size: string | null;
  family: string | null;
  search: string;
  lookingGood: boolean;
};

type B2BProductFiltersProps = {
  categories: string[];
  sizes: string[];
  families: string[];
  filters: ProductFilters;
  onFilterChange: (filters: ProductFilters) => void;
};

export function B2BProductFilters({
  categories,
  sizes,
  families,
  filters,
  onFilterChange,
}: B2BProductFiltersProps) {
  return (
    <div className="space-y-4 mb-6">
      {/* Top Row: Search + Looking Good Toggle */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <Label htmlFor="search" className="sr-only">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              type="search"
              placeholder="Search products..."
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              className="pl-9"
            />
          </div>
        </div>

        {/* Looking Good Toggle */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-background shrink-0">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <Label htmlFor="looking-good" className="text-sm font-medium cursor-pointer whitespace-nowrap">
            Looking Good
          </Label>
          <Switch
            id="looking-good"
            checked={filters.lookingGood}
            onCheckedChange={(checked) => onFilterChange({ ...filters, lookingGood: checked })}
          />
        </div>
      </div>

      {/* Bottom Row: Dropdown Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Family Filter */}
        {families.length > 0 && (
          <div className="w-full sm:w-44">
            <Label htmlFor="family" className="sr-only">Family</Label>
            <Select
              value={filters.family || 'all'}
              onValueChange={(value) =>
                onFilterChange({ ...filters, family: value === 'all' ? null : value })
              }
            >
              <SelectTrigger id="family">
                <SelectValue placeholder="All Families" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Families</SelectItem>
                {families.map((family) => (
                  <SelectItem key={family} value={family}>
                    {family}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="w-full sm:w-44">
            <Label htmlFor="category" className="sr-only">Category</Label>
            <Select
              value={filters.category || 'all'}
              onValueChange={(value) =>
                onFilterChange({ ...filters, category: value === 'all' ? null : value })
              }
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Size Filter */}
        {sizes.length > 0 && (
          <div className="w-full sm:w-44">
            <Label htmlFor="size" className="sr-only">Size</Label>
            <Select
              value={filters.size || 'all'}
              onValueChange={(value) =>
                onFilterChange({ ...filters, size: value === 'all' ? null : value })
              }
            >
              <SelectTrigger id="size">
                <SelectValue placeholder="All Sizes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {sizes.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
