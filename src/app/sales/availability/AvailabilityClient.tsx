'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, Package, Layers, Leaf, Box } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ProductGroupWithAvailability } from '@/server/sales/product-groups-with-availability';
import type { ProductWithBatches } from '@/server/sales/products-with-batches';

type Props = {
  productGroups: ProductGroupWithAvailability[];
  products: ProductWithBatches[];
};

export function AvailabilityClient({ productGroups, products }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedVarieties, setExpandedVarieties] = useState<Set<string>>(new Set());

  // Group products by variety for drill-down
  const productVarietyMap = useMemo(() => {
    const map = new Map<string, Map<string, { varietyName: string; family: string | null; batches: ProductWithBatches['batches'] }>>();
    
    products.forEach((product) => {
      const varietyMap = new Map<string, { varietyName: string; family: string | null; batches: ProductWithBatches['batches'] }>();
      
      product.batches.forEach((batch) => {
        const key = batch.plantVariety;
        if (!varietyMap.has(key)) {
          varietyMap.set(key, {
            varietyName: batch.plantVariety,
            family: batch.family ?? null,
            batches: [],
          });
        }
        varietyMap.get(key)!.batches.push(batch);
      });
      
      map.set(product.id, varietyMap);
    });
    
    return map;
  }, [products]);

  // Filter groups based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return productGroups;
    
    const query = searchQuery.toLowerCase();
    return productGroups.filter((group) => {
      // Check group name
      if (group.name.toLowerCase().includes(query)) return true;
      
      // Check child product names
      return group.children.some((child) => 
        child.productName.toLowerCase().includes(query)
      );
    });
  }, [productGroups, searchQuery]);

  // Filter standalone products (not in any group) based on search
  const filteredStandaloneProducts = useMemo(() => {
    const productsInGroups = new Set<string>();
    productGroups.forEach((group) => {
      group.children.forEach((child) => productsInGroups.add(child.productId));
    });
    
    const standalone = products.filter((p) => !productsInGroups.has(p.id));
    
    if (!searchQuery.trim()) return standalone;
    
    const query = searchQuery.toLowerCase();
    return standalone.filter((p) => 
      p.name.toLowerCase().includes(query) ||
      p.plantVariety.toLowerCase().includes(query)
    );
  }, [products, productGroups, searchQuery]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleVariety = (key: string) => {
    setExpandedVarieties((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Calculate totals
  const totals = useMemo(() => {
    const groupTotal = productGroups.reduce((sum, g) => sum + g.availableStock, 0);
    const standaloneTotal = filteredStandaloneProducts.reduce((sum, p) => sum + p.netAvailableStock, 0);
    return { groups: groupTotal, standalone: standaloneTotal, total: groupTotal + standaloneTotal };
  }, [productGroups, filteredStandaloneProducts]);

  return (
    <div className="space-y-4">
      {/* Search and Summary */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups, products, or varieties..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <span className="text-muted-foreground">Groups:</span>
            <span className="font-semibold">{filteredGroups.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">Total Available:</span>
            <span className="font-semibold">{totals.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Product Groups (Level 1) */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b bg-muted/30 text-sm font-semibold text-muted-foreground">
          <div className="col-span-5">Name</div>
          <div className="col-span-2 text-right">Total Stock</div>
          <div className="col-span-2 text-right">Reserved</div>
          <div className="col-span-3 text-right">Available</div>
        </div>

        {filteredGroups.length === 0 && filteredStandaloneProducts.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No availability data found.
          </div>
        ) : (
          <div className="divide-y">
            {/* Product Groups */}
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              
              return (
                <div key={group.id}>
                  {/* Group Row (Level 1) */}
                  <div
                    className="grid grid-cols-12 gap-4 px-4 py-3 items-center cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="col-span-5 flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <Layers className="h-4 w-4 text-blue-600 shrink-0" />
                      <div>
                        <div className="font-medium">{group.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {group.children.length} product{group.children.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-right font-medium">
                      {group.totalStock.toLocaleString()}
                    </div>
                    <div className="col-span-2 text-right text-muted-foreground">
                      {(group.specificReserved + group.genericReserved) > 0 && (
                        <span className="text-amber-600">
                          {(group.specificReserved + group.genericReserved).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="col-span-3 text-right">
                      <Badge variant={group.availableStock > 0 ? 'default' : 'secondary'} className="font-semibold">
                        {group.availableStock.toLocaleString()}
                      </Badge>
                    </div>
                  </div>

                  {/* Products in Group (Level 2) */}
                  {isExpanded && group.children.map((child) => {
                    const product = products.find((p) => p.id === child.productId);
                    const isProductExpanded = expandedProducts.has(child.productId);
                    const varietyMap = productVarietyMap.get(child.productId);
                    const varieties = varietyMap ? Array.from(varietyMap.entries()) : [];
                    
                    return (
                      <div key={child.productId} className="bg-muted/10">
                        {/* Product Row (Level 2) */}
                        <div
                          className={cn(
                            "grid grid-cols-12 gap-4 px-4 py-2 items-center ml-6 border-l-2 border-blue-200",
                            varieties.length > 0 && "cursor-pointer hover:bg-muted/20"
                          )}
                          onClick={() => varieties.length > 0 && toggleProduct(child.productId)}
                        >
                          <div className="col-span-5 flex items-center gap-2">
                            {varieties.length > 0 ? (
                              isProductExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              )
                            ) : (
                              <div className="w-4" />
                            )}
                            <Package className="h-4 w-4 text-green-600 shrink-0" />
                            <div>
                              <div className="text-sm">{child.productName}</div>
                              {product?.size && (
                                <div className="text-xs text-muted-foreground">{product.size}</div>
                              )}
                            </div>
                          </div>
                          <div className="col-span-2 text-right text-sm">
                            {child.batches.reduce((sum, b) => sum + b.quantity, 0).toLocaleString()}
                          </div>
                          <div className="col-span-2 text-right text-sm text-muted-foreground">
                            {child.batches.reduce((sum, b) => sum + b.reservedQuantity, 0) > 0 && (
                              <span className="text-amber-600">
                                {child.batches.reduce((sum, b) => sum + b.reservedQuantity, 0).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="col-span-3 text-right">
                            <span className="text-sm font-medium">
                              {child.availableStock.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Varieties (Level 3) */}
                        {isProductExpanded && varieties.map(([varietyKey, variety]) => {
                          const varietyExpandKey = `${child.productId}-${varietyKey}`;
                          const isVarietyExpanded = expandedVarieties.has(varietyExpandKey);
                          const varietyTotal = variety.batches.reduce((sum, b) => sum + b.quantity, 0);
                          
                          return (
                            <div key={varietyKey} className="bg-muted/5">
                              {/* Variety Row (Level 3) */}
                              <div
                                className={cn(
                                  "grid grid-cols-12 gap-4 px-4 py-2 items-center ml-12 border-l-2 border-green-200",
                                  variety.batches.length > 1 && "cursor-pointer hover:bg-muted/20"
                                )}
                                onClick={() => variety.batches.length > 1 && toggleVariety(varietyExpandKey)}
                              >
                                <div className="col-span-5 flex items-center gap-2">
                                  {variety.batches.length > 1 ? (
                                    isVarietyExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                    )
                                  ) : (
                                    <div className="w-3" />
                                  )}
                                  <Leaf className="h-3 w-3 text-emerald-600 shrink-0" />
                                  <div>
                                    <div className="text-xs font-medium">{variety.varietyName}</div>
                                    {variety.family && (
                                      <div className="text-[10px] text-muted-foreground">{variety.family}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="col-span-2 text-right text-xs">
                                  {varietyTotal.toLocaleString()}
                                </div>
                                <div className="col-span-2 text-right text-xs text-muted-foreground">
                                  {variety.batches.length} batch{variety.batches.length !== 1 ? 'es' : ''}
                                </div>
                                <div className="col-span-3 text-right">
                                  <span className="text-xs font-medium">
                                    {varietyTotal.toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              {/* Batches (Level 4) */}
                              {isVarietyExpanded && variety.batches.map((batch) => (
                                <div
                                  key={batch.id}
                                  className="grid grid-cols-12 gap-4 px-4 py-1.5 items-center ml-16 border-l-2 border-emerald-200 bg-white/50"
                                >
                                  <div className="col-span-5 flex items-center gap-2">
                                    <div className="w-3" />
                                    <Box className="h-3 w-3 text-slate-500 shrink-0" />
                                    <div>
                                      <div className="text-xs">#{batch.batchNumber}</div>
                                      {batch.location && (
                                        <div className="text-[10px] text-muted-foreground">{batch.location}</div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="col-span-2 text-right text-xs">
                                    {batch.quantity.toLocaleString()}
                                  </div>
                                  <div className="col-span-2 text-right text-[10px] text-muted-foreground">
                                    {batch.grade && <span className="mr-1">Grade {batch.grade}</span>}
                                    {batch.status && <span>{batch.status}</span>}
                                  </div>
                                  <div className="col-span-3 text-right">
                                    <span className="text-xs">
                                      {batch.quantity.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Standalone Products (not in any group) */}
            {filteredStandaloneProducts.length > 0 && (
              <>
                <div className="px-4 py-2 bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Standalone Products
                </div>
                {filteredStandaloneProducts.map((product) => {
                  const isProductExpanded = expandedProducts.has(product.id);
                  const varietyMap = productVarietyMap.get(product.id);
                  const varieties = varietyMap ? Array.from(varietyMap.entries()) : [];
                  
                  return (
                    <div key={product.id}>
                      <div
                        className={cn(
                          "grid grid-cols-12 gap-4 px-4 py-3 items-center",
                          varieties.length > 0 && "cursor-pointer hover:bg-muted/20"
                        )}
                        onClick={() => varieties.length > 0 && toggleProduct(product.id)}
                      >
                        <div className="col-span-5 flex items-center gap-2">
                          {varieties.length > 0 ? (
                            isProductExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            )
                          ) : (
                            <div className="w-4" />
                          )}
                          <Package className="h-4 w-4 text-green-600 shrink-0" />
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {product.plantVariety} - {product.size}
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 text-right font-medium">
                          {product.availableStock.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right text-muted-foreground">
                          {(product.orderReserved + product.groupReserved) > 0 && (
                            <span className="text-amber-600">
                              {(product.orderReserved + product.groupReserved).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="col-span-3 text-right">
                          <Badge variant={product.netAvailableStock > 0 ? 'default' : 'secondary'} className="font-semibold">
                            {product.netAvailableStock.toLocaleString()}
                          </Badge>
                        </div>
                      </div>

                      {/* Varieties for standalone products */}
                      {isProductExpanded && varieties.map(([varietyKey, variety]) => {
                        const varietyExpandKey = `${product.id}-${varietyKey}`;
                        const isVarietyExpanded = expandedVarieties.has(varietyExpandKey);
                        const varietyTotal = variety.batches.reduce((sum, b) => sum + b.quantity, 0);
                        
                        return (
                          <div key={varietyKey} className="bg-muted/5">
                            <div
                              className={cn(
                                "grid grid-cols-12 gap-4 px-4 py-2 items-center ml-6 border-l-2 border-green-200",
                                variety.batches.length > 1 && "cursor-pointer hover:bg-muted/20"
                              )}
                              onClick={() => variety.batches.length > 1 && toggleVariety(varietyExpandKey)}
                            >
                              <div className="col-span-5 flex items-center gap-2">
                                {variety.batches.length > 1 ? (
                                  isVarietyExpanded ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  )
                                ) : (
                                  <div className="w-3" />
                                )}
                                <Leaf className="h-3 w-3 text-emerald-600 shrink-0" />
                                <div>
                                  <div className="text-xs font-medium">{variety.varietyName}</div>
                                  {variety.family && (
                                    <div className="text-[10px] text-muted-foreground">{variety.family}</div>
                                  )}
                                </div>
                              </div>
                              <div className="col-span-2 text-right text-xs">
                                {varietyTotal.toLocaleString()}
                              </div>
                              <div className="col-span-2 text-right text-xs text-muted-foreground">
                                {variety.batches.length} batch{variety.batches.length !== 1 ? 'es' : ''}
                              </div>
                              <div className="col-span-3 text-right">
                                <span className="text-xs font-medium">{varietyTotal.toLocaleString()}</span>
                              </div>
                            </div>

                            {isVarietyExpanded && variety.batches.map((batch) => (
                              <div
                                key={batch.id}
                                className="grid grid-cols-12 gap-4 px-4 py-1.5 items-center ml-12 border-l-2 border-emerald-200 bg-white/50"
                              >
                                <div className="col-span-5 flex items-center gap-2">
                                  <div className="w-3" />
                                  <Box className="h-3 w-3 text-slate-500 shrink-0" />
                                  <div>
                                    <div className="text-xs">#{batch.batchNumber}</div>
                                    {batch.location && (
                                      <div className="text-[10px] text-muted-foreground">{batch.location}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="col-span-2 text-right text-xs">
                                  {batch.quantity.toLocaleString()}
                                </div>
                                <div className="col-span-2 text-right text-[10px] text-muted-foreground">
                                  {batch.grade && <span className="mr-1">Grade {batch.grade}</span>}
                                  {batch.status && <span>{batch.status}</span>}
                                </div>
                                <div className="col-span-3 text-right">
                                  <span className="text-xs">{batch.quantity.toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
