'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { AlertTriangle, Plus, ImageIcon } from 'lucide-react';
import type { CustomerCatalogProduct, CartItem } from '@/lib/b2b/types';

type B2BProductCardProps = {
  product: CustomerCatalogProduct;
  onAddToCart: (item: CartItem) => void;
  viewMode?: 'card' | 'list';
};

const LOW_STOCK_THRESHOLD = 100;

export function B2BProductCard({ product, onAddToCart, viewMode = 'card' }: B2BProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState(
    product.availableBatches[0]?.id || ''
  );
  const [rrp, setRrp] = useState(product.suggestedRrp?.toString() || '');
  const [multibuyPrice2, setMultibuyPrice2] = useState('');
  const [multibuyQty2, setMultibuyQty2] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const isLowStock = product.totalAvailableQty < LOW_STOCK_THRESHOLD;
  const selectedBatch = product.availableBatches.find((b) => b.id === selectedBatchId);

  const handleAddToCart = () => {
    if (!product.unitPriceExVat) return;

    const cartItem: CartItem = {
      productId: product.productId,
      skuId: product.skuId,
      productName: product.aliasName || product.productName,
      varietyName: product.varietyName,
      sizeName: product.sizeName,
      quantity,
      unitPriceExVat: product.unitPriceExVat,
      vatRate: product.vatRate,
      batchId: selectedBatchId || undefined,
      batchNumber: selectedBatch?.batchNumber,
      rrp: rrp ? parseFloat(rrp) : undefined,
      multibuyPrice2: multibuyPrice2 ? parseFloat(multibuyPrice2) : undefined,
      multibuyQty2: multibuyQty2 ? parseInt(multibuyQty2) : undefined,
    };

    onAddToCart(cartItem);

    // Reset form
    setQuantity(1);
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
          {product.heroImageUrl ? (
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

  // Batch Selector (shared by both views)
  const batchSelector = (compact = false) => (
    product.availableBatches.length > 0 && (
      <div className={compact ? 'flex-1 min-w-[140px]' : 'space-y-1'}>
        {!compact && (
          <Label htmlFor={`batch-${product.productId}`} className="text-xs">
            Select Batch ({product.availableBatches.length} available)
          </Label>
        )}
        <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
          <SelectTrigger id={`batch-${product.productId}`} className="h-8 text-xs">
            <SelectValue placeholder="Batch..." />
          </SelectTrigger>
          <SelectContent>
            {product.availableBatches.map((batch) => (
              <SelectItem key={batch.id} value={batch.id}>
                <span className="flex items-center gap-2">
                  <span>
                    {batch.batchNumber}
                    {batch.varietyName && ` - ${batch.varietyName}`}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {batch.availableQty}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <>
        {imageDialog}
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
              {product.varietyName} {product.sizeName && `• ${product.sizeName}`}
            </p>
          </div>

          {/* Price */}
          <div className="text-right shrink-0">
            <span className="font-semibold">€{product.unitPriceExVat?.toFixed(2) || '0.00'}</span>
          </div>

          {/* Batch Selection */}
          {batchSelector(true)}

          {/* Quantity */}
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="h-8 w-20"
          />

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
            disabled={!product.unitPriceExVat || quantity < 1}
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
                    {product.varietyName} {product.sizeName && `• ${product.sizeName}`}
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

          {/* Batch Selection */}
          {batchSelector(false)}
          {selectedBatch && (
            <p className="text-xs text-muted-foreground -mt-2">
              Stock: {selectedBatch.availableQty} units
            </p>
          )}

          {/* Quantity */}
          <div className="space-y-1">
            <Label htmlFor={`qty-${product.productId}`} className="text-xs">
              Quantity
            </Label>
            <Input
              id={`qty-${product.productId}`}
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="h-8"
            />
          </div>

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
            disabled={!product.unitPriceExVat || quantity < 1}
            className="w-full mt-auto"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
