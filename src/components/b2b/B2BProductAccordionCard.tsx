'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Plus, ImageIcon, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useVarietyAllocations } from '@/hooks/useVarietyAllocations';
import { VarietyAllocationTable } from './VarietyAllocationTable';
import { cn } from '@/lib/utils';
import { StockStatusIndicator } from '@/components/sales/ProductATSBadge';
import type { CustomerCatalogProductWithVarieties, CartItem } from '@/lib/b2b/types';
import type { StockStatus } from '@/app/sales/allocation-actions';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';

const LOW_STOCK_THRESHOLD = 100;

/**
 * Convert totalAvailableQty to StockStatus for B2B display
 */
function getStockStatus(availableQty: number, lowThreshold = LOW_STOCK_THRESHOLD): StockStatus {
  if (availableQty <= 0) return 'out_of_stock';
  if (availableQty <= lowThreshold) return 'low_stock';
  return 'in_stock';
}

type B2BProductAccordionCardProps = {
  product: CustomerCatalogProductWithVarieties;
  onAddToTrolley: (items: CartItem | CartItem[]) => void;
  viewMode?: 'card' | 'list';
  currency?: CurrencyCode;
};

/**
 * Calculate quantity presets for shelf/trolley buttons
 * Returns null if shelf quantity is not configured
 */
function getQuantityPresets(product: CustomerCatalogProductWithVarieties) {
  const shelfQty = product.shelfQuantity;
  const trolleyQty = product.trolleyQuantity;
  const shelvesPerTrolley = product.shelvesPerTrolley ?? 6;

  if (!shelfQty || shelfQty <= 0) return null;

  const halfShelf = Math.floor(shelfQty / 2);
  const fullShelf = shelfQty;
  // Use trolleyQuantity directly if available, otherwise calculate from shelf × shelves
  const fullTrolley = trolleyQty && trolleyQty > 0
    ? trolleyQty
    : shelfQty * shelvesPerTrolley;

  return { halfShelf, fullShelf, fullTrolley };
}

/**
 * Multi-level accordion product card for B2B orders
 * Level 1: Product row with generic quantity input + Quick Add
 * Level 2: Variety allocation table (accordion content)
 * Level 3: Batch selection modal (opens from variety table)
 */
export function B2BProductAccordionCard({
  product,
  onAddToTrolley,
  viewMode = 'card',
  currency = 'EUR',
}: B2BProductAccordionCardProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>('');

  const {
    mode,
    genericQuantity,
    setGenericQuantity,
    varietyAllocations,
    updateVarietyQuantity,
    updateVarietyBatches,
    totalQuantity,
    isValid,
    toCartItems,
    reset,
  } = useVarietyAllocations({ product });

  const isLowStock = product.totalAvailableQty < LOW_STOCK_THRESHOLD;
  const hasVarieties = product.varieties && product.varieties.length > 0;
  const presets = getQuantityPresets(product);

  const handleGenericQuantityChange = (value: string) => {
    const qty = parseInt(value) || 0;
    const clamped = Math.min(Math.max(0, qty), product.totalAvailableQty);
    setGenericQuantity(clamped);
  };

  const handlePresetAdd = (amount: number) => {
    const newQty = Math.min(genericQuantity + amount, product.totalAvailableQty);
    setGenericQuantity(newQty);
  };

  const handleQuickAdd = () => {
    if (!product.unitPriceExVat || genericQuantity < 1) return;

    // Pricing (RRP, multi-buy) is set in the checkout pricing step
    const trolleyItems = toCartItems();

    // Pass single item for generic, array for variety/batch
    onAddToTrolley(trolleyItems.length === 1 ? trolleyItems[0] : trolleyItems);

    // Reset form
    reset();
    setAccordionValue(''); // Collapse accordion
  };

  const handleAddToTrolley = () => {
    if (!product.unitPriceExVat || !isValid) return;

    // Pricing (RRP, multi-buy) is set in the checkout pricing step
    const trolleyItems = toCartItems();

    onAddToTrolley(trolleyItems.length === 1 ? trolleyItems[0] : trolleyItems);

    // Reset form
    reset();
    setAccordionValue('');
  };

  // Format product display name
  const formatProductDisplay = () => {
    if (product.family && product.varietyName) {
      return `${product.family} > ${product.varietyName}`;
    }
    return product.varietyName || product.productName;
  };

  // Image Dialog (shared)
  const imageDialog = (
    <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>{product.aliasName || product.productName}</DialogTitle>
        </VisuallyHidden>
        <div className="relative aspect-square w-full">
          {product.galleryImages && product.galleryImages.length > 0 ? (
            <div className="h-full w-full flex overflow-x-auto snap-x snap-mandatory">
              {product.galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  className="relative w-full h-full flex-shrink-0 snap-start"
                  style={{ minWidth: '100%' }}
                >
                  <Image
                    src={img.url}
                    alt={product.aliasName || product.productName}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 500px"
                  />
                  {img.badge && (
                    <Badge className="absolute top-2 left-2" variant="secondary">
                      {img.badge}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : product.heroImageUrl ? (
            <Image
              src={product.heroImageUrl}
              alt={product.aliasName || product.productName}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 500px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <ImageIcon className="h-24 w-24 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="p-4 bg-background">
          <h3 className="font-semibold">{product.aliasName || product.productName}</h3>
          <p className="text-sm text-muted-foreground">
            {formatProductDisplay()} {product.sizeName && `• ${product.sizeName}`}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Image Thumbnail - uses div to avoid nested button issue inside AccordionTrigger
  const imageThumbnail = (size: 'sm' | 'md' | 'lg' = 'md') => (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setImageDialogOpen(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          setImageDialogOpen(true);
        }
      }}
      className={cn(
        'relative shrink-0 rounded-md overflow-hidden border bg-muted hover:ring-2 hover:ring-primary/50 transition-all cursor-zoom-in',
        size === 'sm' ? 'w-12 h-12' : size === 'md' ? 'w-20 h-20' : 'w-24 h-24'
      )}
      title="Click to view larger image"
    >
      {product.heroImageUrl ? (
        <Image
          src={product.heroImageUrl}
          alt={product.aliasName || product.productName}
          fill
          className="object-cover"
          sizes={size === 'sm' ? '48px' : size === 'md' ? '80px' : '96px'}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className={size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-8 w-8' : 'h-10 w-10'} />
        </div>
      )}
    </div>
  );

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <>
        {imageDialog}
        <Accordion
          type="single"
          collapsible
          value={accordionValue}
          onValueChange={setAccordionValue}
          className="w-full"
        >
          <AccordionItem value="item-1" className="border rounded-lg bg-card overflow-hidden">
            <AccordionTrigger asChild className="hover:no-underline p-0 cursor-pointer">
              <div className="flex items-stretch w-full" tabIndex={0} role="button">
                {/* Large Image - left side */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageDialogOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setImageDialogOpen(true);
                    }
                  }}
                  className="relative w-28 h-28 shrink-0 bg-muted hover:opacity-90 transition-opacity cursor-zoom-in"
                  title="Click to view larger image"
                >
                  {product.heroImageUrl ? (
                    <Image
                      src={product.heroImageUrl}
                      alt={product.aliasName || product.productName}
                      fill
                      className="object-cover"
                      sizes="112px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                {/* Content area */}
                <div className="flex-1 flex items-center gap-4 px-4 py-3">
                  {/* Product Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base truncate">
                        {product.aliasName || product.productName}
                      </span>
                      {isLowStock && (
                        <Badge variant="destructive" className="shrink-0 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Low
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {formatProductDisplay()} {product.sizeName && `• ${product.sizeName}`}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <span className="font-bold text-lg">
                      {formatCurrency(product.unitPriceExVat ?? 0, currency)}
                    </span>
                  </div>

                  {/* Stock Status Indicator */}
                  <div className="shrink-0 flex items-center gap-2">
                    <StockStatusIndicator status={getStockStatus(product.totalAvailableQty)} size="md" />
                    <span className="text-xs text-muted-foreground">
                      {product.totalAvailableQty}
                    </span>
                  </div>

                  {/* Quick quantity buttons + input */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {/* Preset buttons - always visible when presets available */}
                    {mode === 'generic' && presets && (
                      <div className="hidden sm:flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGenericQuantity(presets.halfShelf);
                          }}
                          disabled={presets.halfShelf > product.totalAvailableQty}
                          className="h-8 text-xs px-2"
                          title={`Add ${presets.halfShelf} (½ Shelf)`}
                        >
                          ½S
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGenericQuantity(presets.fullShelf);
                          }}
                          disabled={presets.fullShelf > product.totalAvailableQty}
                          className="h-8 text-xs px-2"
                          title={`Add ${presets.fullShelf} (1 Shelf)`}
                        >
                          1S
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGenericQuantity(presets.fullTrolley);
                          }}
                          disabled={presets.fullTrolley > product.totalAvailableQty}
                          className="h-8 text-xs px-2"
                          title={`Add ${presets.fullTrolley} (1 Trolley)`}
                        >
                          1T
                        </Button>
                      </div>
                    )}

                    {/* Quantity Input */}
                    <div className="w-20">
                      {mode === 'generic' ? (
                        <Input
                          type="number"
                          min="0"
                          max={product.totalAvailableQty}
                          value={genericQuantity || ''}
                          onChange={(e) => handleGenericQuantityChange(e.target.value)}
                          placeholder="Qty"
                          className="h-8 text-center text-sm"
                        />
                      ) : (
                        <div className="h-8 flex items-center justify-center">
                          <Badge variant="secondary" className="font-semibold text-sm px-2 py-0.5">
                            {totalQuantity}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Quick Add Button */}
                    {mode === 'generic' && genericQuantity > 0 && (
                      <Button
                        onClick={handleQuickAdd}
                        disabled={!product.unitPriceExVat}
                        size="sm"
                        className="h-8"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Chevron icon */}
                  <ChevronDown className={cn(
                    "h-5 w-5 shrink-0 transition-transform duration-200 text-muted-foreground",
                    accordionValue === 'item-1' && "rotate-180"
                  )} />
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 pt-3">
                {/* Quick Add Preset Buttons */}
                {mode === 'generic' && presets && (
                  <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
                    <span className="text-sm text-muted-foreground mr-1">Quick add:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetAdd(presets.halfShelf)}
                      disabled={presets.halfShelf > product.totalAvailableQty - genericQuantity}
                      className="h-8 text-xs"
                    >
                      +½ Shelf ({presets.halfShelf})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetAdd(presets.fullShelf)}
                      disabled={presets.fullShelf > product.totalAvailableQty - genericQuantity}
                      className="h-8 text-xs"
                    >
                      +1 Shelf ({presets.fullShelf})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetAdd(presets.fullTrolley)}
                      disabled={presets.fullTrolley > product.totalAvailableQty - genericQuantity}
                      className="h-8 text-xs"
                    >
                      +1 Trolley ({presets.fullTrolley})
                    </Button>
                  </div>
                )}

                {/* Variety Allocation Table (Level 2) */}
                {hasVarieties && (
                  <VarietyAllocationTable
                    varieties={product.varieties}
                    varietyAllocations={varietyAllocations}
                    onQuantityChange={updateVarietyQuantity}
                    onBatchesChange={updateVarietyBatches}
                    productName={product.aliasName || product.productName}
                  />
                )}

                {/* Total Summary */}
                {totalQuantity > 0 && (
                  <div className="flex items-center justify-between p-3 bg-primary/5 rounded-md">
                    <span className="text-sm font-medium">Total Quantity:</span>
                    <span className="text-lg font-semibold">{totalQuantity} plants</span>
                  </div>
                )}

                {/* Add to Trolley Button */}
                <Button
                  onClick={handleAddToTrolley}
                  disabled={!product.unitPriceExVat || !isValid}
                  className="w-full"
                  size="lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {isValid ? `Add ${totalQuantity} to Trolley` : 'Select Quantity First'}
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </>
    );
  }

  // CARD VIEW (default)
  return (
    <>
      {imageDialog}
      <Card className="flex flex-col h-full">
        <Accordion
          type="single"
          collapsible
          value={accordionValue}
          onValueChange={setAccordionValue}
          className="w-full"
        >
          <AccordionItem value="item-1" className="border-0">
            <CardHeader className="pb-3">
              <AccordionTrigger asChild className="cursor-pointer">
                <div className="flex items-start gap-4 w-full" tabIndex={0} role="button">
                  {imageThumbnail('lg')}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold line-clamp-2">
                          {product.aliasName || product.productName}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {formatProductDisplay()} {product.sizeName && `• ${product.sizeName}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isLowStock && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Low
                          </Badge>
                        )}
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          accordionValue === 'item-1' && "rotate-180"
                        )} />
                      </div>
                    </div>

                    {/* Price & Stock */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-semibold">
                        {formatCurrency(product.unitPriceExVat ?? 0, currency)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <StockStatusIndicator status={getStockStatus(product.totalAvailableQty)} size="sm" />
                        <span className="text-xs text-muted-foreground">
                          {product.totalAvailableQty}
                        </span>
                      </div>
                    </div>

                    {/* Generic Quantity Input (Level 1) */}
                    <div className="mt-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      {mode === 'generic' ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="0"
                            max={product.totalAvailableQty}
                            value={genericQuantity || ''}
                            onChange={(e) => handleGenericQuantityChange(e.target.value)}
                            placeholder="Quantity"
                            className="h-9 flex-1"
                          />
                          {genericQuantity > 0 && (
                            <Button
                              onClick={handleQuickAdd}
                              disabled={!product.unitPriceExVat}
                              size="sm"
                              className="h-9"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Quick Add
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2 bg-primary/5 rounded-md">
                          <span className="text-sm text-muted-foreground">Total:</span>
                          <span className="font-semibold">{totalQuantity} plants</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
            </CardHeader>

            <AccordionContent className="pb-0">
              <CardContent className="flex flex-col gap-3 text-sm pt-0">
                {/* Quick Add Preset Buttons */}
                {mode === 'generic' && presets && (
                  <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
                    <span className="text-xs text-muted-foreground">Quick add:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetAdd(presets.halfShelf)}
                      disabled={presets.halfShelf > product.totalAvailableQty - genericQuantity}
                      className="h-7 text-xs px-2"
                    >
                      +½ Shelf ({presets.halfShelf})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetAdd(presets.fullShelf)}
                      disabled={presets.fullShelf > product.totalAvailableQty - genericQuantity}
                      className="h-7 text-xs px-2"
                    >
                      +1 Shelf ({presets.fullShelf})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetAdd(presets.fullTrolley)}
                      disabled={presets.fullTrolley > product.totalAvailableQty - genericQuantity}
                      className="h-7 text-xs px-2"
                    >
                      +1 Trolley ({presets.fullTrolley})
                    </Button>
                  </div>
                )}

                {/* Variety Allocation Table (Level 2) */}
                {hasVarieties && (
                  <VarietyAllocationTable
                    varieties={product.varieties}
                    varietyAllocations={varietyAllocations}
                    onQuantityChange={updateVarietyQuantity}
                    onBatchesChange={updateVarietyBatches}
                    productName={product.aliasName || product.productName}
                  />
                )}

                {/* Add to Trolley Button */}
                <Button
                  onClick={handleAddToTrolley}
                  disabled={!product.unitPriceExVat || !isValid}
                  className="w-full mt-auto"
                  size="lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {isValid ? `Add ${totalQuantity} to Trolley` : 'Expand to Select Varieties'}
                </Button>
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </>
  );
}
