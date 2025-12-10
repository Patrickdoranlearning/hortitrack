'use client';

import { UseFormReturn, Controller } from 'react-hook-form';
import { CreateOrderInput, CustomerAddress } from '@/lib/sales/types';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

type Props = {
  form: UseFormReturn<CreateOrderInput>;
  customers: { id: string; name: string }[];
  selectedCustomer?: { id: string; name: string };
  customerAddresses: CustomerAddress[];
  onOpenCopyDialog: () => void;
  prefillPending: boolean;
};

export function CustomerDeliveryStep({
  form,
  customers,
  selectedCustomer,
  customerAddresses,
  onOpenCopyDialog,
  prefillPending,
}: Props) {
  const storeId = form.watch('storeId');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Step 1: Customer & Delivery</h2>
          <p className="text-sm text-muted-foreground">Select the customer and delivery location.</p>
        </div>
        <Button variant="outline" type="button" onClick={onOpenCopyDialog} disabled={!selectedCustomer || prefillPending}>
          <Copy className="h-4 w-4 mr-2" />
          Copy Previous Order
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FormField
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer *</FormLabel>
              <Select
                value={field.value}
                onValueChange={(val) => {
                  field.onChange(val);
                  form.setValue('customerId', val, { shouldValidate: true });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="deliveryDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order Date</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="date" {...field} value={field.value ?? ''} />
                  <CalendarIcon className="h-4 w-4 text-muted-foreground absolute right-3 top-2.5" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shipMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Method</FormLabel>
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose method" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="van">Van Delivery</SelectItem>
                  <SelectItem value="haulier">Haulier</SelectItem>
                  <SelectItem value="collection">Collection</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="orderReference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference</FormLabel>
              <FormControl>
                <Input placeholder="e.g. PO Number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="storeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deliver To</FormLabel>
              <Select
                value={field.value || 'main'}
                onValueChange={(value) => {
                  field.onChange(value);
                  if (value === 'custom') {
                    form.setValue('deliveryAddress', '');
                    form.setValue('shipToAddressId', undefined);
                  } else {
                    const address = customerAddresses.find((a) => a.id === value);
                    if (address) {
                      form.setValue('deliveryAddress', formatAddress(address));
                      form.setValue('shipToAddressId', address.id);
                    } else {
                      form.setValue('shipToAddressId', undefined);
                    }
                  }
                }}
                disabled={!selectedCustomer}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedCustomer ? 'Select delivery location' : 'Select a customer first'} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {customerAddresses.length > 0 ? (
                    <>
                      {customerAddresses.map((address) => (
                        <SelectItem key={address.id} value={address.id}>
                          {address.storeName || address.label}
                          {address.isDefaultShipping && ' (Default)'}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom delivery address</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="main">{selectedCustomer?.name || 'Main premises'}</SelectItem>
                      <SelectItem value="custom">Custom delivery address</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="deliveryAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{storeId === 'custom' ? 'Custom Address' : 'Delivery Address'}</FormLabel>
              <FormControl>
                <Input
                  placeholder={storeId === 'custom' ? 'Enter delivery address' : 'Address will auto-fill'}
                  {...field}
                  readOnly={storeId !== 'custom'}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="notesCustomer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Visible to customer" {...field} value={field.value ?? ''} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notesInternal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Internal Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Internal only" {...field} value={field.value ?? ''} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <div className="flex items-center gap-3">
        <Controller
          control={form.control}
          name="autoPrint"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Switch checked={field.value} onCheckedChange={field.onChange} />
              <span className="text-sm">Auto print pick list and invoice</span>
            </div>
          )}
        />
      </div>
    </div>
  );
}

function formatAddress(address: CustomerAddress) {
  const parts = [address.line1, address.line2, address.city, address.county, address.eircode].filter(Boolean);
  return parts.join(', ');
}
