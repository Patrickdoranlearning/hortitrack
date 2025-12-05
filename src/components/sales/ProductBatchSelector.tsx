'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Info, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Batch {
  id: string;
  batchNumber: string;
  plantVariety: string;
  size: string;
  quantity: number;
  grade?: string;
  location?: string;
  status?: string;
  plantingDate?: string;
}

export interface Product {
  id: string;
  name: string;
  plantVariety: string;
  size: string;
  availableStock: number;
  batches?: Batch[];
  aliases?: Array<{
    id: string;
    aliasName: string | null;
    customerId: string | null;
    customerSkuCode?: string | null;
    isActive?: boolean | null;
  }>;
}

interface ProductBatchSelectorProps {
  products: Product[];
  value?: {
    productId?: string;
    plantVariety?: string;
    size?: string;
    specificBatchId?: string;
    gradePreference?: 'A' | 'B' | 'C';
    preferredBatchNumbers?: string[];
  };
  onChange: (value: any) => void;
  mode: 'basic' | 'specific';
  onModeChange?: (mode: 'basic' | 'specific') => void;
  customerId?: string;
  className?: string;
}

const AUTO_ALLOCATE_VALUE = 'auto-allocate';

export function ProductBatchSelector({
  products,
  value,
  onChange,
  mode,
  onModeChange,
  customerId,
  className,
}: ProductBatchSelectorProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showBatchDetails, setShowBatchDetails] = useState(false);

  useEffect(() => {
    if (value?.productId) {
      const product = products.find(p => p.id === value.productId);
      setSelectedProduct(product || null);
    }
  }, [value?.productId, products]);

  const resolveLabel = (product: Product) => {
    const alias = product.aliases?.find(
      (a) => a.isActive !== false && (!!customerId ? a.customerId === customerId : !!a.aliasName)
    );

    if (alias?.aliasName) {
      return alias.aliasName;
    }

    if (product.name) return product.name;
    return `${product.plantVariety} - ${product.size}`;
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      onChange({
        productId: product.id,
        plantVariety: product.plantVariety,
        size: product.size,
        specificBatchId: undefined,
        gradePreference: undefined,
        preferredBatchNumbers: undefined,
      });
    }
  };

  const handleBatchSelection = (batchId: string) => {
    if (batchId === AUTO_ALLOCATE_VALUE) {
      onChange({
        ...value,
        specificBatchId: undefined,
      });
      return;
    }
    const batch = selectedProduct?.batches?.find(b => b.id === batchId);
    if (batch) {
      onChange({
        ...value,
        specificBatchId: batchId,
        plantVariety: batch.plantVariety,
        size: batch.size,
      });
    }
  };

  const handleGradePreference = (grade: 'A' | 'B' | 'C') => {
    onChange({
      ...value,
      gradePreference: grade,
    });
  };

  const togglePreferredBatch = (batchNumber: string) => {
    const current = value?.preferredBatchNumbers || [];
    const updated = current.includes(batchNumber)
      ? current.filter(b => b !== batchNumber)
      : [...current, batchNumber];
    onChange({
      ...value,
      preferredBatchNumbers: updated,
    });
  };

  const availableBatches = selectedProduct?.batches || [];
  const totalStock = selectedProduct?.availableStock || 0;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label>Product</Label>
          <Select
            value={value?.productId || ''}
            onValueChange={handleProductChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map(product => (
                <SelectItem key={product.id} value={product.id}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{resolveLabel(product)}</span>
                    <span className="text-xs text-muted-foreground">
                      {product.plantVariety} · {product.size} · {product.availableStock} available
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {onModeChange && (
          <div className="flex items-center gap-2 pt-6">
            <Button
              type="button"
              variant={mode === 'basic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('basic')}
            >
              Basic
            </Button>
            <Button
              type="button"
              variant={mode === 'specific' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('specific')}
            >
              Specific
            </Button>
          </div>
        )}
      </div>

      {selectedProduct && mode === 'specific' && (
        <div className="border rounded-lg p-4 bg-muted/30 w-full">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Batch Selection Options</h4>
            <Badge variant="secondary">{totalStock} plants available</Badge>
          </div>

          <div className="space-y-4">
            {/* Specific Batch Selection */}
            <div>
              <Label className="text-xs">Select Specific Batch</Label>
              <Select
                value={value?.specificBatchId ?? AUTO_ALLOCATE_VALUE}
                onValueChange={handleBatchSelection}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auto-allocate (or choose specific batch)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_ALLOCATE_VALUE}>Auto-allocate</SelectItem>
                  {availableBatches.map(batch => {
                    const label = `${batch.plantVariety} - ${batch.size} - ${batch.batchNumber}`;
                    return (
                      <SelectItem key={batch.id} value={batch.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {batch.quantity} plants{batch.location ? ` · ${batch.location}` : ''}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Grade Preference */}
            <div>
              <Label className="text-xs">Grade Preference</Label>
              <div className="flex gap-2 mt-1">
                {(['A', 'B', 'C'] as const).map(grade => (
                  <Button
                    key={grade}
                    type="button"
                    variant={value?.gradePreference === grade ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleGradePreference(grade)}
                  >
                    Grade {grade}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={!value?.gradePreference ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onChange({ ...value, gradePreference: undefined })}
                >
                  Any Grade
                </Button>
              </div>
            </div>

            {/* Batch Details Popover */}
            {availableBatches.length > 0 && (
              <Popover open={showBatchDetails} onOpenChange={setShowBatchDetails}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                  >
                    <Info className="h-4 w-4 mr-2" />
                    View All Batch Details
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px]" align="start">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm mb-3">Available Batches</h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {availableBatches.map(batch => (
                        <div
                          key={batch.id}
                          className="flex items-start gap-3 p-2 border rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            togglePreferredBatch(batch.batchNumber);
                          }}
                        >
                          <Checkbox
                            checked={value?.preferredBatchNumbers?.includes(batch.batchNumber)}
                            onCheckedChange={() => togglePreferredBatch(batch.batchNumber)}
                          />
                          <div className="flex-1 text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{batch.batchNumber}</span>
                              <Badge variant="outline">{batch.quantity} plants</Badge>
                              {batch.grade && (
                                <Badge variant="secondary">Grade {batch.grade}</Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground">
                              {batch.location && <span>Location: {batch.location}</span>}
                              {batch.status && <span className="ml-2">Status: {batch.status}</span>}
                            </div>
                            {batch.plantingDate && (
                              <div className="text-muted-foreground">
                                Planted: {new Date(batch.plantingDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {value?.preferredBatchNumbers && value.preferredBatchNumbers.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          {value.preferredBatchNumbers.length} batch(es) preferred
                        </p>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      )}

      {selectedProduct && mode === 'basic' && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Info className="h-3 w-3" />
          <span>
            System will automatically allocate from available batches ({totalStock} plants)
          </span>
        </div>
      )}
    </div>
  );
}
