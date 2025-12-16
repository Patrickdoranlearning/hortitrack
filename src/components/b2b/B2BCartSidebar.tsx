'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, Calendar } from 'lucide-react';
import { B2BCartLineItem } from './B2BCartLineItem';
import type { CartItem } from '@/lib/b2b/types';
import type { Database } from '@/types/supabase';

type CustomerAddress = Database['public']['Tables']['customer_addresses']['Row'];

type B2BCartSidebarProps = {
  cart: CartItem[];
  addresses: CustomerAddress[];
  onUpdateCart: (cart: CartItem[]) => void;
  onSubmit: (deliveryAddressId: string, deliveryDate?: string, notes?: string) => Promise<void>;
};

export function B2BCartSidebar({ cart, addresses, onUpdateCart, onSubmit }: B2BCartSidebarProps) {
  const [selectedAddressId, setSelectedAddressId] = useState(
    addresses.find((a) => a.is_default_shipping)?.id || addresses[0]?.id || ''
  );
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateLineItem = (index: number, updates: Partial<CartItem>) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], ...updates };
    onUpdateCart(newCart);
  };

  const removeLineItem = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    onUpdateCart(newCart);
  };

  // Calculate totals
  const subtotalExVat = cart.reduce((sum, item) => sum + item.quantity * item.unitPriceExVat, 0);
  const vatAmount = cart.reduce((sum, item) => {
    const lineTotal = item.quantity * item.unitPriceExVat;
    return sum + (lineTotal * (item.vatRate / 100));
  }, 0);
  const totalIncVat = subtotalExVat + vatAmount;

  const handleSubmit = async () => {
    if (!selectedAddressId || cart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(selectedAddressId, deliveryDate || undefined, notes || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="sticky top-20 h-fit">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <CardTitle>Your Trolley</CardTitle>
        </div>
        <CardDescription>
          {cart.length} {cart.length === 1 ? 'item' : 'items'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Trolley Items */}
        {cart.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Your trolley is empty. Add products to get started.
          </p>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {cart.map((item, index) => (
                <B2BCartLineItem
                  key={index}
                  item={item}
                  onUpdate={(updates) => updateLineItem(index, updates)}
                  onRemove={() => removeLineItem(index)}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {cart.length > 0 && (
          <>
            {/* Delivery Address */}
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="delivery-address">Delivery Address</Label>
              <Select value={selectedAddressId} onValueChange={setSelectedAddressId}>
                <SelectTrigger id="delivery-address">
                  <SelectValue placeholder="Select address..." />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((address) => (
                    <SelectItem key={address.id} value={address.id}>
                      {address.label || address.store_name || `${address.line1}, ${address.city}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delivery Date */}
            <div className="space-y-2">
              <Label htmlFor="delivery-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Requested Delivery Date (Optional)
              </Label>
              <input
                id="delivery-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Order Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Order Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any special instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Totals */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (ex VAT):</span>
                <span>€{subtotalExVat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT:</span>
                <span>€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                <span>Total (inc VAT):</span>
                <span>€{totalIncVat.toFixed(2)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!selectedAddressId || cart.length === 0 || isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? 'Placing Order...' : 'Place Order'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
