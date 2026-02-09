'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CartItem } from '@/lib/b2b/types';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';

export type PricingHint = {
  rrp?: number | null;
  multibuyPrice2?: number | null;
  multibuyQty2?: number | null;
};

type Props = {
  cart: CartItem[];
  pricingHints?: Record<string, PricingHint>; // keyed by productId
  onUpdateItem: (index: number, updates: Partial<CartItem>) => void;
  currency?: CurrencyCode;
};

export function B2BCheckoutPricing({ cart, pricingHints, onUpdateItem, currency = 'EUR' }: Props) {
  const subtotalExVat = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPriceExVat, 0),
    [cart]
  );

  return (
    <div className="space-y-4">
      {cart.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add items to set pricing.</p>
      ) : (
        <>
          <ScrollArea className="h-[360px] pr-2">
            <div className="space-y-3">
              {cart.map((item, index) => {
                const hint = pricingHints?.[item.productId];
                return (
                  <Card key={`${item.productId}-${index}`} className="border-muted">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium leading-tight">
                        {item.productName}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {item.varietyName} {item.sizeName && `• ${item.sizeName}`}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">RRP</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.rrp ?? ''}
                            onChange={(e) => onUpdateItem(index, { rrp: parseFloat(e.target.value) || 0 })}
                            placeholder={
                              hint?.rrp
                                ? `Last used: ${formatCurrency(Number(hint.rrp), currency)}`
                                : 'Enter RRP'
                            }
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Multi-buy Qty</Label>
                          <Input
                            type="number"
                            value={item.multibuyQty2 ?? ''}
                            onChange={(e) => onUpdateItem(index, { multibuyQty2: parseInt(e.target.value) || 0 })}
                            placeholder={
                              hint?.multibuyQty2 ? `${hint.multibuyQty2}` : 'e.g., 3'
                            }
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Multi-buy Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.multibuyPrice2 ?? ''}
                            onChange={(e) =>
                              onUpdateItem(index, { multibuyPrice2: parseFloat(e.target.value) || 0 })
                            }
                            placeholder={
                              hint?.multibuyPrice2
                                ? formatCurrency(Number(hint.multibuyPrice2), currency)
                                : 'e.g., 10.00'
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>

                      {hint && (hint.rrp || hint.multibuyPrice2) && (
                        <Badge variant="outline" className="text-[11px]">
                          Last used pricing applied where available
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>

          <div className="text-sm font-medium">
            Order subtotal (ex VAT): {formatCurrency(subtotalExVat, currency)}
          </div>
        </>
      )}
    </div>
  );
}




