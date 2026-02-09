'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import type { CartItem } from '@/lib/b2b/types';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';

type B2BCartLineItemProps = {
  item: CartItem;
  onUpdate: (updates: Partial<CartItem>) => void;
  onRemove: () => void;
  currency?: CurrencyCode;
};

export function B2BCartLineItem({ item, onUpdate, onRemove, currency = 'EUR' }: B2BCartLineItemProps) {
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
          <span className="text-sm">{formatCurrency(item.unitPriceExVat, currency)}</span>
        </div>

        {item.rrp && (
          <div className="text-xs text-muted-foreground mt-1">
            RRP: {formatCurrency(item.rrp, currency)}
          </div>
        )}
        {item.multibuyQty2 && item.multibuyPrice2 && (
          <div className="text-xs text-muted-foreground">
            Multi-buy: {item.multibuyQty2} for {formatCurrency(item.multibuyPrice2, currency)}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end justify-between">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">{formatCurrency(lineTotal, currency)}</span>
      </div>
    </div>
  );
}
