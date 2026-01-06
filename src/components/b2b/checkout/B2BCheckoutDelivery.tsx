'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { Database } from '@/types/supabase';

type CustomerAddress = Database['public']['Tables']['customer_addresses']['Row'];

type Props = {
  addresses: CustomerAddress[];
  deliveryAddressId: string;
  deliveryDate?: string;
  notes?: string;
  onChange: (updates: { deliveryAddressId?: string; deliveryDate?: string; notes?: string }) => void;
};

export function B2BCheckoutDelivery({
  addresses,
  deliveryAddressId,
  deliveryDate,
  notes,
  onChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="delivery-address">Delivery Address</Label>
        <Select value={deliveryAddressId} onValueChange={(val) => onChange({ deliveryAddressId: val })}>
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

      <div className="space-y-2">
        <Label htmlFor="delivery-date">Requested Delivery Date (Optional)</Label>
        <Input
          id="delivery-date"
          type="date"
          value={deliveryDate || ''}
          onChange={(e) => onChange({ deliveryDate: e.target.value })}
          className="h-9"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Order Notes (Optional)</Label>
        <Textarea
          id="notes"
          placeholder="Any special instructions..."
          value={notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}




