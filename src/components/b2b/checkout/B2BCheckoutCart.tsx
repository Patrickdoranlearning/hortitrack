'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { B2BCartLineItem } from '../B2BCartLineItem';
import type { CartItem } from '@/lib/b2b/types';

type Props = {
  cart: CartItem[];
  onUpdateItem: (index: number, updates: Partial<CartItem>) => void;
  onRemoveItem: (index: number) => void;
};

export function B2BCheckoutCart({ cart, onUpdateItem, onRemoveItem }: Props) {
  const subtotalExVat = cart.reduce((sum, item) => sum + item.quantity * item.unitPriceExVat, 0);

  return (
    <div className="space-y-4">
      {cart.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your cart is empty. Add products to continue.</p>
      ) : (
        <>
          <ScrollArea className="h-[320px] pr-2">
            <div className="space-y-3">
              {cart.map((item, index) => (
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
