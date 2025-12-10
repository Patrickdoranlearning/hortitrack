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
import type { CustomerCatalogProductWithVarieties, CartItem } from '@/lib/b2b/types';

const LOW_STOCK_THRESHOLD = 100;

type B2BProductAccordionCardProps = {
  product: CustomerCatalogProductWithVarieties;
  onAddToCart: (items: CartItem | CartItem[]) => void;
  viewMode?: 'card' | 'list';
};

/**
 * Multi-level accordion product card for B2B orders
 * Level 1: Product row with generic quantity input + Quick Add
 * Level 2: Variety allocation table (accordion content)
 * Level 3: Batch selection modal (opens from variety table)
 */
export function B2BProductAccordionCard({
  product,
  onAddToCart,
  viewMode = 'card',
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

  const handleGenericQuantityChange = (value: string) => {
    const qty = parseInt(value) || 0;
    const clamped = Math.min(Math.max(0, qty), product.totalAvailableQty);
    setGenericQuantity(clamped);
  };

  const handleQuickAdd = () => {
    if (!product.unitPriceExVat || genericQuantity < 1) return;

    // Pricing (RRP, multi-buy) is set in the checkout pricing step
    const cartItems = toCartItems();

    // Pass single item for generic, array for variety/batch
    onAddToCart(cartItems.length === 1 ? cartItems[0] : cartItems);

    // Reset form
    reset();
    setAccordionValue(''); // Collapse accordion
  };

  const handleAddToCart = () => {
    if (!product.unitPriceExVat || !isValid) return;

    // Pricing (RRP, multi-buy) is set in the checkout pricing step
    const cartItems = toCartItems();

    onAddToCart(cartItems.length === 1 ? cartItems[0] : cartItems);

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
  const imageThumbnail = (size: 'sm' | 'md' = 'md') => (
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
        size === 'sm' ? 'w-12 h-12' : 'w-16 h-16'
      )}
      title="Click to view larger image"
    >
      {product.heroImageUrl ? (
        <Image
          src={product.heroImageUrl}
          alt={product.aliasName || product.productName}
          fill
          className="object-cover"
          sizes={size === 'sm' ? '48px' : '64px'}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className={size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'} />
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
          <AccordionItem value="item-1" className="border rounded-lg">
            <AccordionTrigger asChild className="hover:no-underline px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-4 w-full" tabIndex={0} role="button">
                {/* Image */}
                {imageThumbnail('sm')}

                {/* Product Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {product.aliasName || product.productName}
                    </span>
                    {isLowStock && (
                      <Badge variant="destructive" className="shrink-0 text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Low
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatProductDisplay()} {product.sizeName && `• ${product.sizeName}`}
                  </p>
                </div>

                {/* Price */}
                <div className="text-right shrink-0 w-20">
                  <span className="font-semibold">
                    €{product.unitPriceExVat?.toFixed(2) || '0.00'}
                  </span>
                </div>

                {/* Stock Badge */}
                <div className="shrink-0 w-24">
                  <Badge variant={isLowStock ? 'destructive' : 'secondary'} className="text-xs">
                    {product.totalAvailableQty} stock
                  </Badge>
                </div>

                {/* Generic Quantity Input (Level 1) */}
                <div className="w-24" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  {mode === 'generic' ? (
                    <Input
                      type="number"
                      min="0"
                      max={product.totalAvailableQty}
                      value={genericQuantity || ''}
                      onChange={(e) => handleGenericQuantityChange(e.target.value)}
                      placeholder="Qty"
                      className="h-9 text-center"
                    />
                  ) : (
                    <div className="h-9 flex items-center justify-center">
                      <Badge variant="secondary" className="font-semibold">
                        {totalQuantity}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Quick Add Button (appears when generic qty > 0) */}
                {mode === 'generic' && genericQuantity > 0 && (
                  <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button
                      onClick={handleQuickAdd}
                      disabled={!product.unitPriceExVat}
                      size="sm"
                      className="h-9"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}

                {/* Chevron icon */}
                <ChevronDown className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200",
                  accordionValue === 'item-1' && "rotate-180"
                )} />
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 pt-3">
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

                {/* Add to Cart Button */}
                <Button
                  onClick={handleAddToCart}
                  disabled={!product.unitPriceExVat || !isValid}
                  className="w-full"
                  size="lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {isValid ? `Add ${totalQuantity} to Cart` : 'Select Quantity First'}
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
                <div className="flex items-start gap-3 w-full" tabIndex={0} role="button">
                  {imageThumbnail('md')}
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
                        €{product.unitPriceExVat?.toFixed(2) || '0.00'}
                      </span>
                      <Badge variant={isLowStock ? 'destructive' : 'secondary'} className="text-xs">
                        {product.totalAvailableQty} in stock
                      </Badge>
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

                {/* Add to Cart Button */}
                <Button
                  onClick={handleAddToCart}
                  disabled={!product.unitPriceExVat || !isValid}
                  className="w-full mt-auto"
                  size="lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {isValid ? `Add ${totalQuantity} to Cart` : 'Expand to Select Varieties'}
                </Button>
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </>
  );
}
