'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import type { CartItem } from '@/lib/b2b/types';

type B2BCartLineItemProps = {
  item: CartItem;
  onUpdate: (updates: Partial<CartItem>) => void;
  onRemove: () => void;
};

export function B2BCartLineItem({ item, onUpdate, onRemove }: B2BCartLineItemProps) {
  const lineTotal = item.quantity * item.unitPriceExVat;

  return (
    <div className="flex gap-2 p-3 rounded-lg border bg-card">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm line-clamp-1">{item.productName}</div>
        <div className="text-xs text-muted-foreground">
          {item.varietyName} {item.sizeName && `• ${item.sizeName}`}
        </div>
        {item.batchNumber && (
          <div className="text-xs text-muted-foreground">
            Batch: {item.batchNumber}
          </div>
        )}

        <div className="flex items-center gap-2 mt-2">
          <Input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onUpdate({ quantity: parseInt(e.target.value) || 1 })}
            className="h-7 w-16 text-xs"
          />
          <span className="text-xs text-muted-foreground">×</span>
          <span className="text-sm">€{item.unitPriceExVat.toFixed(2)}</span>
        </div>

        {item.rrp && (
          <div className="text-xs text-muted-foreground mt-1">
            RRP: €{item.rrp.toFixed(2)}
          </div>
        )}
        {item.multibuyQty2 && item.multibuyPrice2 && (
          <div className="text-xs text-muted-foreground">
            Multi-buy: {item.multibuyQty2} for €{item.multibuyPrice2.toFixed(2)}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end justify-between">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">€{lineTotal.toFixed(2)}</span>
      </div>
    </div>
  );
}
