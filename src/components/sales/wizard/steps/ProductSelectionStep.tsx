'use client';

import { useMemo, useState } from 'react';
import { UseFieldArrayAppend, UseFieldArrayRemove, FieldArrayWithId, UseFormReturn } from 'react-hook-form';
import type { CreateOrderInput, VarietyBreakdownMap } from '@/lib/sales/types';
import type { ProductWithBatches } from '@/server/sales/products-with-batches';
import type { ProductGroupWithAvailability } from '@/server/sales/product-groups-with-availability';
import { SalesProductAccordionRow, type PricingHint } from '../SalesProductAccordionRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, Filter, X } from 'lucide-react';
type Props = {
  form: UseFormReturn<CreateOrderInput>;
  products: ProductWithBatches[];
  productGroups?: ProductGroupWithAvailability[];
  fields: FieldArrayWithId<CreateOrderInput, 'lines', 'id'>[];
  append: UseFieldArrayAppend<CreateOrderInput, 'lines'>;
  remove: UseFieldArrayRemove;
  selectedCustomerId?: string;
  pricingHints?: Record<string, PricingHint>;
  varietyBreakdowns?: VarietyBreakdownMap;
  onVarietyQtyChange?: (fieldId: string, productId: string, qty: number) => void;
  onInitBreakdown?: (fieldId: string, group: ProductGroupWithAvailability) => void;
};

type SortOption = 'name' | 'family' | 'stock' | 'price';

export function ProductSelectionStep({
  form,
  products,
  productGroups = [],
  fields,
  append,
  remove,
  selectedCustomerId,
  pricingHints = {},
  varietyBreakdowns = {},
  onVarietyQtyChange,
  onInitBreakdown,
}: Props) {
  const [search, setSearch] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [familyFilter, setFamilyFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Extract unique families from all products
  const families = useMemo(() => {
    const familySet = new Set<string>();
    for (const product of products) {
      if (product.family) {
        familySet.add(product.family);
      }
      // Also check batch families
      for (const batch of product.batches) {
        if (batch.family) {
          familySet.add(batch.family);
        }
      }
    }
    return Array.from(familySet).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const base = products;

    const aliasMatches = base.filter((product) =>
      product.aliases?.some((alias) => alias.isActive !== false && alias.customerId === selectedCustomerId)
    );

    let list: ProductWithBatches[] = [];
    if (!selectedCustomerId) {
      list = base;
    } else if (showAllProducts) {
      const aliasIds = new Set(aliasMatches.map((p) => p.id));
      list = [...aliasMatches, ...base.filter((p) => !aliasIds.has(p.id))];
    } else {
      list = aliasMatches.length > 0 ? aliasMatches : base;
    }

    // Apply family filter
    if (familyFilter) {
      list = list.filter((p) => {
        // Check product-level family
        if (p.family === familyFilter) return true;
        // Check batch families
        return p.batches.some(b => b.family === familyFilter);
      });
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => {
        const label = p.name?.toLowerCase() || '';
        const variety = p.plantVariety?.toLowerCase() || '';
        const size = p.size?.toLowerCase() || '';
        const family = p.family?.toLowerCase() || '';
        return label.includes(q) || variety.includes(q) || size.includes(q) || family.includes(q);
      });
    }

    // Apply sorting
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '');
          break;
        case 'family':
          cmp = (a.family || '').localeCompare(b.family || '');
          break;
        case 'stock':
          cmp = (a.availableStock || 0) - (b.availableStock || 0);
          break;
        case 'price':
          cmp = (a.defaultPrice || 0) - (b.defaultPrice || 0);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return sorted;
  }, [products, selectedCustomerId, showAllProducts, search, familyFilter, sortBy, sortAsc]);

  const clearFilters = () => {
    setSearch('');
    setFamilyFilter('');
    setSortBy('name');
    setSortAsc(true);
    setShowAllProducts(false);
  };

  const hasActiveFilters = search || familyFilter || sortBy !== 'name' || !sortAsc;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Step 2: Products & Varieties</h2>
          <p className="text-sm text-muted-foreground">
            Select products, set quantities, and optionally expand to specify varieties.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showAllProducts} onCheckedChange={(checked) => setShowAllProducts(checked)} />
          <span>Show all products (not just aliases)</span>
        </div>
      </div>

      {/* Filters & Sort Row */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search products, varieties, or family..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        
        {/* Family Filter */}
        {families.length > 0 && (
          <Select 
            value={familyFilter || '__all__'} 
            onValueChange={(v) => setFamilyFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All families" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All families</SelectItem>
              {families.map((family) => (
                <SelectItem key={family} value={family}>
                  {family}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[140px]">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="family">Family</SelectItem>
            <SelectItem value="stock">Stock</SelectItem>
            <SelectItem value="price">Price</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSortAsc(!sortAsc)}
        >
          {sortAsc ? '↑ Asc' : '↓ Desc'}
        </Button>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {filteredProducts.length} of {products.length} products
        </span>
      </div>

      {/* Table-like container */}
      <div className="border rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-1 md:gap-2 items-center py-2 px-2 md:px-3 bg-muted/50 border-b text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <div className="col-span-6 md:col-span-4">Product</div>
          <div className="col-span-2 md:col-span-1 text-center">Qty</div>
          <div className="hidden md:block md:col-span-1 text-right">Price</div>
          <div className="hidden md:block md:col-span-1 text-right">VAT %</div>
          <div className="hidden md:block md:col-span-1 text-right">Total</div>
          <div className="col-span-4 md:col-span-4 text-right pr-2 md:pr-10">Varieties</div>
        </div>

        {/* Table Body */}
        {fields.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No products added yet. Click &ldquo;Add product line&rdquo; to start.
          </div>
        ) : (
          fields.map((field, index) => (
            <SalesProductAccordionRow
              key={field.id}
              fieldId={field.id}
              index={index}
              form={form}
              products={products}
              productGroups={productGroups}
              filteredProducts={filteredProducts}
              onRemove={() => remove(index)}
              selectedCustomerId={selectedCustomerId}
              pricingHints={pricingHints}
              varietyBreakdown={varietyBreakdowns[field.id]}
              onVarietyQtyChange={onVarietyQtyChange ? (productId, qty) => onVarietyQtyChange(field.id, productId, qty) : undefined}
              onInitBreakdown={onInitBreakdown ? (group) => onInitBreakdown(field.id, group) : undefined}
            />
          ))
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            plantVariety: '',
            size: '',
            qty: 1,
            allowSubstitute: true,
            unitPrice: undefined,
            vatRate: 13.5,
            description: '',
          })
        }
      >
        + Add product line
      </Button>
    </div>
  );
}
