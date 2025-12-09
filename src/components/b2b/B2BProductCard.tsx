'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { AlertTriangle, Plus, ImageIcon, Layers } from 'lucide-react';
import type { CustomerCatalogProduct, CartItem, BatchAllocation } from '@/lib/b2b/types';
import { B2BBatchSelectionDialog, type B2BBatch } from './B2BBatchSelectionDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type B2BProductCardProps = {
  product: CustomerCatalogProduct;
  onAddToCart: (item: CartItem) => void;
  viewMode?: 'card' | 'list';
};

const LOW_STOCK_THRESHOLD = 100;

export function B2BProductCard({ product, onAddToCart, viewMode = 'card' }: B2BProductCardProps) {
  const [rrp, setRrp] = useState(product.suggestedRrp?.toString() || '');
  const [multibuyPrice2, setMultibuyPrice2] = useState('');
  const [multibuyQty2, setMultibuyQty2] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchAllocations, setBatchAllocations] = useState<BatchAllocation[]>([]);
  const [selectedVariety, setSelectedVariety] = useState<string>('any');

  const isLowStock = product.totalAvailableQty < LOW_STOCK_THRESHOLD;
  
  // Calculate total quantity from batch allocations
  const totalQuantity = batchAllocations.reduce((sum, a) => sum + a.qty, 0);

  const varietyOptions = Array.from(
    new Set(
      product.availableBatches
        .map((b) => b.varietyName)
        .filter((name): name is string => Boolean(name))
    )
  );

  const filteredBatches = selectedVariety === 'any'
    ? product.availableBatches
    : product.availableBatches.filter((b) => b.varietyName === selectedVariety);
  
  // Convert product batches to B2BBatch format
  const b2bBatches: B2BBatch[] = filteredBatches.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    varietyName: b.varietyName,
    family: b.family,
    availableQty: b.availableQty,
  }));

  const handleBatchConfirm = (allocations: BatchAllocation[]) => {
    setBatchAllocations(allocations);
  };

  const handleAddToCart = () => {
    if (!product.unitPriceExVat || totalQuantity < 1) return;

    // Resolve variety ID from selected variety name (via batches)
    let resolvedVarietyId: string | undefined;
    if (selectedVariety !== 'any') {
      const matchingBatch = product.availableBatches.find(b => b.varietyName === selectedVariety);
      resolvedVarietyId = matchingBatch?.varietyId ?? undefined;
    }

    // Resolve batch ID - if only one batch allocated, use it
    const resolvedBatchId = batchAllocations.length === 1 ? batchAllocations[0].batchId : undefined;

    const cartItem: CartItem = {
      productId: product.productId,
      skuId: product.skuId,
      productName: product.aliasName || product.productName,
      varietyName: product.varietyName,
      sizeName: product.sizeName,
      quantity: totalQuantity,
      unitPriceExVat: product.unitPriceExVat,
      vatRate: product.vatRate,
      requiredVarietyId: resolvedVarietyId,
      requiredVarietyName: selectedVariety === 'any' ? undefined : selectedVariety,
      requiredBatchId: resolvedBatchId,
      // Use batchAllocations for multi-batch, or single batchId for backwards compatibility
      batchAllocations: batchAllocations.length > 0 ? batchAllocations : undefined,
      batchId: resolvedBatchId,
      batchNumber: batchAllocations.length === 1 ? batchAllocations[0].batchNumber : undefined,
      rrp: rrp ? parseFloat(rrp) : undefined,
      multibuyPrice2: multibuyPrice2 ? parseFloat(multibuyPrice2) : undefined,
      multibuyQty2: multibuyQty2 ? parseInt(multibuyQty2) : undefined,
    };

    onAddToCart(cartItem);

    // Reset form
    setBatchAllocations([]);
    setRrp(product.suggestedRrp?.toString() || '');
    setMultibuyPrice2('');
    setMultibuyQty2('');
  };

  // Image Dialog (shared by both views)
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
            {product.varietyName} {product.sizeName && `• ${product.sizeName}`}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Image Thumbnail Button (shared by both views)
  const imageThumbnail = (size: 'sm' | 'md' = 'md') => (
    <button
      type="button"
      onClick={() => setImageDialogOpen(true)}
      className={`relative shrink-0 rounded-md overflow-hidden border bg-muted hover:ring-2 hover:ring-primary/50 transition-all cursor-zoom-in ${
        size === 'sm' ? 'w-12 h-12' : 'w-16 h-16'
      }`}
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
    </button>
  );

  // Format product display name with family
  const formatProductDisplay = () => {
    if (product.family && product.varietyName) {
      return `${product.family} > ${product.varietyName}`;
    }
    return product.varietyName || product.productName;
  };

  const varietySelector = (compact = false) => (
    <div className={compact ? 'flex-1 min-w-[140px]' : 'space-y-1'}>
      {!compact && (
        <Label className="text-xs">
          Variety
        </Label>
      )}
      <Select value={selectedVariety} onValueChange={setSelectedVariety}>
        <SelectTrigger className={compact ? 'h-8 text-xs' : 'h-8'}>
          <SelectValue placeholder="Any / Grower's Choice" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any / Grower&apos;s Choice</SelectItem>
          {varietyOptions.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // Batch Selector Button (shared by both views)
  const batchSelector = (compact = false) => (
    product.availableBatches.length > 0 && (
      <div className={compact ? 'flex-1 min-w-[140px]' : 'space-y-1'}>
        {!compact && (
          <Label className="text-xs">
            Select Batches ({product.availableBatches.length} available)
          </Label>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={compact ? 'h-8 w-full text-xs' : 'h-8 w-full text-xs'}
          onClick={() => setBatchDialogOpen(true)}
        >
          <Layers className="h-3 w-3 mr-1" />
          {batchAllocations.length > 0 
            ? `${batchAllocations.length} batch(es) - ${totalQuantity} plants`
            : 'Select Batches'
          }
        </Button>
        {batchAllocations.length > 0 && !compact && (
          <div className="flex flex-wrap gap-1 mt-1">
            {batchAllocations.slice(0, 2).map((a) => (
              <Badge key={a.batchId} variant="secondary" className="text-[10px]">
                {a.batchNumber}: {a.qty}
              </Badge>
            ))}
            {batchAllocations.length > 2 && (
              <Badge variant="outline" className="text-[10px]">+{batchAllocations.length - 2} more</Badge>
            )}
          </div>
        )}
      </div>
    )
  );

  // Batch Selection Dialog
  const batchDialog = (
    <B2BBatchSelectionDialog
      open={batchDialogOpen}
      onOpenChange={setBatchDialogOpen}
      batches={b2bBatches}
      productName={product.aliasName || product.productName}
      currentAllocations={batchAllocations}
      onConfirm={handleBatchConfirm}
    />
  );

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <>
        {imageDialog}
        {batchDialog}
        <div className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
          {/* Image */}
          {imageThumbnail('sm')}

          {/* Product Info */}
          <div className="flex-1 min-w-0">
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
          <div className="text-right shrink-0">
            <span className="font-semibold">€{product.unitPriceExVat?.toFixed(2) || '0.00'}</span>
          </div>

          {/* Variety Selection */}
          {varietySelector(true)}

          {/* Batch Selection */}
          {batchSelector(true)}

          {/* Quantity Display */}
          <div className="w-20 text-center text-sm font-medium">
            {totalQuantity > 0 ? `${totalQuantity} pcs` : '-'}
          </div>

          {/* RRP (compact) */}
          <Input
            type="number"
            step="0.01"
            placeholder="RRP"
            value={rrp}
            onChange={(e) => setRrp(e.target.value)}
            className="h-8 w-20"
          />

          {/* Add Button */}
          <Button
            onClick={handleAddToCart}
            disabled={!product.unitPriceExVat || totalQuantity < 1}
            size="sm"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </>
    );
  }

  // CARD VIEW (default)
  return (
    <>
      {imageDialog}
      {batchDialog}
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {imageThumbnail('md')}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base line-clamp-2">
                    {product.aliasName || product.productName}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {formatProductDisplay()} {product.sizeName && `• ${product.sizeName}`}
                  </CardDescription>
                </div>
                {isLowStock && (
                  <Badge variant="destructive" className="flex items-center gap-1 shrink-0">
                    <AlertTriangle className="h-3 w-3" />
                    Low
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-3 text-sm">
          {/* Price */}
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Price:</span>
            <span className="text-lg font-semibold">
              €{product.unitPriceExVat?.toFixed(2) || '0.00'}
            </span>
          </div>

          {/* Variety Selection */}
          {varietySelector(false)}

          {/* Batch Selection */}
          {batchSelector(false)}
          
          {/* Quantity Display */}
          {totalQuantity > 0 && (
            <div className="flex items-center justify-between text-sm bg-primary/5 rounded-md px-3 py-2 -mt-1">
              <span className="text-muted-foreground">Total Qty:</span>
              <span className="font-semibold">{totalQuantity} plants</span>
            </div>
          )}

          {/* RRP (Optional) */}
          <div className="space-y-1">
            <Label htmlFor={`rrp-${product.productId}`} className="text-xs">
              RRP (Optional)
            </Label>
            <Input
              id={`rrp-${product.productId}`}
              type="number"
              step="0.01"
              placeholder={product.suggestedRrp ? `Suggested: €${product.suggestedRrp.toFixed(2)}` : 'Enter RRP'}
              value={rrp}
              onChange={(e) => setRrp(e.target.value)}
              className="h-8"
            />
          </div>

          {/* Multi-buy Pricing (Optional) */}
          <div className="space-y-1">
            <Label className="text-xs">Multi-buy (Optional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Qty (e.g., 3)"
                value={multibuyQty2}
                onChange={(e) => setMultibuyQty2(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Price (e.g., 10)"
                value={multibuyPrice2}
                onChange={(e) => setMultibuyPrice2(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Add to Cart Button */}
          <Button
            onClick={handleAddToCart}
            disabled={!product.unitPriceExVat || totalQuantity < 1}
            className="w-full mt-auto"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            {totalQuantity > 0 ? `Add ${totalQuantity} to Cart` : 'Select Batches First'}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
