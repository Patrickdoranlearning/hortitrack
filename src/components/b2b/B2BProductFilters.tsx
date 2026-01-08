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
import { Search } from 'lucide-react';

type B2BProductFiltersProps = {
  categories: string[];
  sizes: string[];
  filters: {
    category: string | null;
    size: string | null;
    search: string;
  };
  onFilterChange: (filters: { category: string | null; size: string | null; search: string }) => void;
};

export function B2BProductFilters({
  categories,
  sizes,
  filters,
  onFilterChange,
}: B2BProductFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
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

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="w-full sm:w-48">
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
        <div className="w-full sm:w-48">
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
  );
}
