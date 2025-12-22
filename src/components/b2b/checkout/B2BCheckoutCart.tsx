'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle } from 'lucide-react';
import { B2BCartLineItem } from '../B2BCartLineItem';
import TrolleyFillIndicator from '@/components/dispatch/TrolleyFillIndicator';
import type { CartItem } from '@/lib/b2b/types';

type Props = {
  trolley: CartItem[];
  onUpdateItem: (index: number, updates: Partial<CartItem>) => void;
  onRemoveItem: (index: number) => void;
};

export function B2BCheckoutTrolley({ trolley, onUpdateItem, onRemoveItem }: Props) {
  const subtotalExVat = trolley.reduce((sum, item) => sum + item.quantity * item.unitPriceExVat, 0);

  // Build trolley lines for capacity calculation
  // Items without sizeId can still be shown but won't contribute to trolley calculation
  const trolleyLines = trolley
    .filter((item) => item.sizeId) // Only include items with sizeId
    .map((item) => ({
      sizeId: item.sizeId!,
      family: item.family || null,
      quantity: item.quantity,
    }));

  // Check if any items are missing sizeId (for warning display)
  const itemsMissingSizeId = trolley.filter((item) => !item.sizeId).length;

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
                />
              ))}
            </div>
          </ScrollArea>

          <Separator />

          <div className="flex justify-between text-sm font-medium">
            <span>Subtotal (ex VAT)</span>
            <span>€{subtotalExVat.toFixed(2)}</span>
          </div>

          {/* Trolley fill indicator */}
          {trolleyLines.length > 0 ? (
            <TrolleyFillIndicator
              lines={trolleyLines}
              showSuggestions={true}
            />
          ) : itemsMissingSizeId > 0 ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Trolley estimate unavailable - product sizes not configured</span>
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

