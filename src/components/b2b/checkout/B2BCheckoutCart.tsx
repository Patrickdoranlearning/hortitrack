'use client';

import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { B2BCartLineItem } from '../B2BCartLineItem';
import { calculateB2BTrolleys, type B2BTrolleySuggestion } from '@/lib/b2b/trolley-calculation';
import type { CartItem, CustomerCatalogProduct } from '@/lib/b2b/types';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';

type Props = {
  trolley: CartItem[];
  onUpdateItem: (index: number, updates: Partial<CartItem>) => void;
  onRemoveItem: (index: number) => void;
  /** Catalog products for suggestions (optional) */
  products?: Array<Pick<CustomerCatalogProduct, 'sizeName' | 'trolleyQuantity'>>;
  currency?: CurrencyCode;
};

export function B2BCheckoutTrolley({ trolley, onUpdateItem, onRemoveItem, products, currency = 'EUR' }: Props) {
  const subtotalExVat = trolley.reduce((sum, item) => sum + item.quantity * item.unitPriceExVat, 0);

  // Calculate trolley fill using per-product trolleyQuantity
  const trolleyResult = useMemo(() => {
    const lines = trolley.map((item) => ({
      quantity: item.quantity,
      trolleyQuantity: item.trolleyQuantity ?? null,
      sizeName: item.sizeName,
    }));

    return calculateB2BTrolleys(lines, products);
  }, [trolley, products]);

  // Check if any items are missing trolleyQuantity
  const hasValidLines = trolley.some((item) => item.trolleyQuantity && item.trolleyQuantity > 0);

  return (
    <div className="space-y-4">
      {trolley.length === 0 ? (
        <div className="text-center py-8">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Your trolley is empty. Add products to get started.</p>
        </div>
      ) : (
        <>
          <ScrollArea className="h-[320px] pr-2">
            <div className="space-y-3">
              {trolley.map((item, index) => (
                <B2BCartLineItem
                  key={`${item.productId}-${index}`}
                  item={item}
                  onUpdate={(updates) => onUpdateItem(index, updates)}
                  onRemove={() => onRemoveItem(index)}
                  currency={currency}
                />
              ))}
            </div>
          </ScrollArea>

          <Separator />

          <div className="flex justify-between text-sm font-medium">
            <span>Subtotal (ex VAT)</span>
            <span>{formatCurrency(subtotalExVat, currency)}</span>
          </div>

          {/* Trolley fill indicator */}
          {hasValidLines ? (
            <Card className={trolleyResult.currentFillPercent === 100 ? 'border-green-500 bg-green-50' : ''}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Visual trolley display */}
                  <div className="flex items-center gap-3">
                    {/* Trolley icons */}
                    <div className="flex items-center gap-1">
                      {/* Show full trolley icons */}
                      {Array.from({ length: Math.floor(trolleyResult.totalTrolleys) }).map((_, i) => (
                        <div
                          key={`full-${i}`}
                          className="w-8 h-10 rounded border-2 border-green-600 bg-green-500 flex items-center justify-center"
                          title={`Trolley ${i + 1} - Full`}
                        >
                          <Package className="h-4 w-4 text-white" />
                        </div>
                      ))}
                      {/* Show partial trolley if not exactly full */}
                      {trolleyResult.currentFillPercent > 0 && trolleyResult.currentFillPercent < 100 && (
                        <div
                          className="w-8 h-10 rounded border-2 border-muted-foreground/30 bg-muted relative overflow-hidden"
                          title={`Trolley ${Math.ceil(trolleyResult.totalTrolleys)} - ${trolleyResult.currentFillPercent}% full`}
                        >
                          {/* Fill indicator from bottom */}
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-green-500 transition-all"
                            style={{ height: `${trolleyResult.currentFillPercent}%` }}
                          />
                          <Package className="h-4 w-4 text-muted-foreground/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                      )}
                    </div>

                    {/* Trolley count and status */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{trolleyResult.displayValue}</span>
                        <span className="text-muted-foreground">
                          {Math.ceil(trolleyResult.totalTrolleys) === 1 ? 'trolley' : 'trolleys'}
                        </span>
                      </div>
                      {trolleyResult.currentFillPercent === 100 ? (
                        <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Trolley full!</span>
                        </div>
                      ) : trolleyResult.totalTrolleys > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {trolleyResult.currentFillPercent}% of current trolley
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Suggestions for what else fits */}
                  {trolleyResult.suggestions.length > 0 && trolleyResult.remainingFraction > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Space remaining for:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {trolleyResult.suggestions.map((suggestion) => (
                          <div
                            key={suggestion.sizeName}
                            className="text-xs bg-muted px-2 py-1 rounded"
                          >
                            {suggestion.unitsCanFit} × {suggestion.sizeName}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warning if some items couldn't be calculated */}
                  {trolleyResult.linesWithoutQuantity > 0 && (
                    <div className="flex items-center gap-2 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{trolleyResult.linesWithoutQuantity} item(s) not included (missing trolley config)</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : trolley.length > 0 ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Trolley estimate unavailable - product quantities not configured</span>
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground">
            Adjust quantities or remove items. Pricing is configured in the next step.
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="w-full md:w-auto">
          Continue browsing
        </Button>
      </div>
    </div>
  );
}




