'use client';

import { UseFormReturn, Controller } from 'react-hook-form';
import { CreateOrderInput, CustomerAddress } from '@/lib/sales/types';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SelectWithCreate } from '@/components/ui/select-with-create';
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer *</FormLabel>
              <SelectWithCreate
                options={customers.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                value={field.value}
                onValueChange={(val) => {
                  field.onChange(val);
                  form.setValue('customerId', val, { shouldValidate: true });
                }}
                createHref="/sales/customers"
                placeholder="Select customer"
                createLabel="Add new customer"
              />
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

      {/* Delivery Location Selection */}
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
                <SelectTrigger className="max-w-md">
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

      {/* Structured Address Display */}
      {storeId && storeId !== 'main' && (
        <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Delivery Address</h4>
          {storeId === 'custom' ? (
            // Custom address - editable fields
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Store Name</label>
                <Input
                  placeholder="Store name (optional)"
                  onChange={(e) => {
                    const current = form.getValues('deliveryAddress') || '';
                    form.setValue('deliveryAddress', e.target.value ? `${e.target.value}, ${current}` : current);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Address Line 1 *</label>
                <Input
                  placeholder="Street address"
                  onChange={(e) => form.setValue('deliveryAddress', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Address Line 2</label>
                <Input placeholder="Apartment, suite, etc." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">City / Town</label>
                <Input placeholder="City" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">County</label>
                <Input placeholder="County" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Eircode / Postcode</label>
                <Input placeholder="Eircode" />
              </div>
            </div>
          ) : (
            // Selected address - read-only display
            (() => {
              const selectedAddress = customerAddresses.find((a) => a.id === storeId);
              if (!selectedAddress) return null;
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {selectedAddress.storeName && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Store Name</span>
                      <span className="font-medium">{selectedAddress.storeName}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted-foreground block">Address Line 1</span>
                    <span className="font-medium">{selectedAddress.line1}</span>
                  </div>
                  {selectedAddress.line2 && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Address Line 2</span>
                      <span className="font-medium">{selectedAddress.line2}</span>
                    </div>
                  )}
                  {selectedAddress.city && (
                    <div>
                      <span className="text-xs text-muted-foreground block">City / Town</span>
                      <span className="font-medium">{selectedAddress.city}</span>
                    </div>
                  )}
                  {selectedAddress.county && (
                    <div>
                      <span className="text-xs text-muted-foreground block">County</span>
                      <span className="font-medium">{selectedAddress.county}</span>
                    </div>
                  )}
                  {selectedAddress.eircode && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Eircode</span>
                      <span className="font-medium">{selectedAddress.eircode}</span>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

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
              <span className="text-sm">Auto print invoice and delivery docket</span>
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
