'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CartItem } from '@/lib/b2b/types';

type Props = {
  cart: CartItem[];
  deliverySummary: {
    addressLabel: string;
    deliveryDate?: string;
    notes?: string;
  };
};

export function B2BCheckoutReview({ cart, deliverySummary }: Props) {
  const subtotalExVat = cart.reduce((sum, item) => sum + item.quantity * item.unitPriceExVat, 0);
  const vatAmount = cart.reduce((sum, item) => {
    const lineTotal = item.quantity * item.unitPriceExVat;
    return sum + lineTotal * (item.vatRate / 100);
  }, 0);
  const totalIncVat = subtotalExVat + vatAmount;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="font-medium">Address: </span>
            <span className="text-muted-foreground">{deliverySummary.addressLabel}</span>
          </div>
          {deliverySummary.deliveryDate && (
            <div>
              <span className="font-medium">Requested date: </span>
              <span className="text-muted-foreground">{deliverySummary.deliveryDate}</span>
            </div>
          )}
          {deliverySummary.notes && (
            <div>
              <span className="font-medium">Notes: </span>
              <span className="text-muted-foreground">{deliverySummary.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[240px] pr-2">
            <div className="space-y-3">
              {cart.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="text-sm border rounded-md p-3">
                  <div className="font-medium">{item.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.varietyName} {item.sizeName && `• ${item.sizeName}`}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[11px]">
                      Qty {item.quantity}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      €{item.unitPriceExVat.toFixed(2)} each
                    </span>
                  </div>
                  {item.rrp && (
                    <div className="text-xs text-muted-foreground mt-1">RRP: €{item.rrp.toFixed(2)}</div>
                  )}
                  {item.multibuyQty2 && item.multibuyPrice2 && (
                    <div className="text-xs text-muted-foreground">
                      Multi-buy: {item.multibuyQty2} for €{item.multibuyPrice2.toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal (ex VAT)</span>
            <span>€{subtotalExVat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT</span>
            <span>€{vatAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-base">
            <span>Total (inc VAT)</span>
            <span>€{totalIncVat.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


