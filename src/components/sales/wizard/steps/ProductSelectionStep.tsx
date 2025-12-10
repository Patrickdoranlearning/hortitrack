'use client';

import { useMemo, useState } from 'react';
import { UseFieldArrayAppend, UseFieldArrayRemove, FieldArrayWithId, UseFormReturn } from 'react-hook-form';
import type { CreateOrderInput } from '@/lib/sales/types';
import type { ProductWithBatches } from '@/server/sales/products-with-batches';
import { SalesProductAccordionRow } from '../SalesProductAccordionRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { BatchAllocation } from '../../BatchSelectionDialog';

type Props = {
  form: UseFormReturn<CreateOrderInput>;
  products: ProductWithBatches[];
  fields: FieldArrayWithId<CreateOrderInput, 'lines', 'id'>[];
  append: UseFieldArrayAppend<CreateOrderInput, 'lines'>;
  remove: UseFieldArrayRemove;
  lineAllocations: Map<number, BatchAllocation[]>;
  onAllocationsChange: (index: number, allocations: BatchAllocation[]) => void;
  selectedCustomerId?: string;
};

export function ProductSelectionStep({
  form,
  products,
  fields,
  append,
  remove,
  lineAllocations,
  onAllocationsChange,
  selectedCustomerId,
}: Props) {
  const [search, setSearch] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);

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

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((p) => {
      const label = p.name?.toLowerCase() || '';
      const variety = p.plantVariety?.toLowerCase() || '';
      const size = p.size?.toLowerCase() || '';
      return label.includes(q) || variety.includes(q) || size.includes(q);
    });
  }, [products, selectedCustomerId, showAllProducts, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Step 2: Products & Batches</h2>
          <p className="text-sm text-muted-foreground">
            Use the accordion rows to pick varieties and batches for each product.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showAllProducts} onCheckedChange={(checked) => setShowAllProducts(checked)} />
          <span>Show all products (not just aliases)</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search products or varieties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('');
            setShowAllProducts(false);
          }}
        >
          Reset
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <SalesProductAccordionRow
            key={field.id}
            index={index}
            form={form}
            products={products}
            filteredProducts={filteredProducts}
            allocations={lineAllocations.get(index) || []}
            onAllocationsChange={onAllocationsChange}
            onRemove={() => remove(index)}
            selectedCustomerId={selectedCustomerId}
          />
        ))}
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
        Add product line
      </Button>
    </div>
  );
}
