'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { upsertSupplierAddressAction } from '@/app/actions';
import type { SupplierAddressSummary } from '@/lib/types';

const COUNTRY_OPTIONS = [
  { code: 'IE', name: 'Ireland' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'XI', name: 'Northern Ireland' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PL', name: 'Poland' },
] as const;

type SupplierAddressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  address: SupplierAddressSummary | null;
  onSaved: () => void;
};

export function SupplierAddressDialog({
  open,
  onOpenChange,
  supplierId,
  address,
  onSaved,
}: SupplierAddressDialogProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    label: '',
    line1: '',
    line2: '',
    city: '',
    county: '',
    eircode: '',
    countryCode: 'IE',
    isDefault: false,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  useEffect(() => {
    if (open) {
      if (address) {
        setForm({
          label: address.label,
          line1: address.line1,
          line2: address.line2 ?? '',
          city: address.city ?? '',
          county: address.county ?? '',
          eircode: address.eircode ?? '',
          countryCode: address.countryCode,
          isDefault: address.isDefault,
          contactName: address.contactName ?? '',
          contactEmail: address.contactEmail ?? '',
          contactPhone: address.contactPhone ?? '',
        });
      } else {
        setForm({
          label: '',
          line1: '',
          line2: '',
          city: '',
          county: '',
          eircode: '',
          countryCode: 'IE',
          isDefault: false,
          contactName: '',
          contactEmail: '',
          contactPhone: '',
        });
      }
    }
  }, [open, address]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) {
      toast({ variant: 'destructive', title: 'Address label is required' });
      return;
    }
    if (!form.line1.trim()) {
      toast({ variant: 'destructive', title: 'Address line 1 is required' });
      return;
    }
    startTransition(async () => {
      const result = await upsertSupplierAddressAction({
        id: address?.id,
        supplierId,
        label: form.label,
        line1: form.line1,
        line2: form.line2 || null,
        city: form.city || null,
        county: form.county || null,
        eircode: form.eircode || null,
        countryCode: form.countryCode,
        isDefault: form.isDefault,
        contactName: form.contactName || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
      });
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Save failed', description: result.error });
        return;
      }
      toast({ title: address ? 'Address updated' : 'Address added' });
      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{address ? 'Edit address' : 'Add address'}</DialogTitle>
          <DialogDescription>
            {address ? 'Update the supplier address details.' : 'Add a new address for this supplier.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Address label *</Label>
            <Input
              placeholder="e.g., Head Office, Warehouse, Nursery Site"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Address line 1 *</Label>
            <Input
              placeholder="Street address"
              value={form.line1}
              onChange={(e) => setForm((p) => ({ ...p, line1: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Address line 2</Label>
            <Input
              placeholder="Apartment, suite, building, etc."
              value={form.line2}
              onChange={(e) => setForm((p) => ({ ...p, line2: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>City / Town</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>County / Region</Label>
              <Input
                value={form.county}
                onChange={(e) => setForm((p) => ({ ...p, county: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>Eircode / Zip / Postal code</Label>
              <Input
                placeholder="e.g., D02 X285"
                value={form.eircode}
                onChange={(e) => setForm((p) => ({ ...p, eircode: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={form.countryCode}
                onValueChange={(v) => setForm((p) => ({ ...p, countryCode: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDefault"
              checked={form.isDefault}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, isDefault: checked === true }))
              }
            />
            <Label htmlFor="isDefault" className="text-sm">
              Set as default address
            </Label>
          </div>

          <div className="border-t pt-4 mt-4">
            <h5 className="font-medium mb-3">Contact at this address</h5>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Contact name</Label>
                <Input
                  placeholder="John Smith"
                  value={form.contactName}
                  onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact phone</Label>
                <Input
                  placeholder="+353 1 234 5678"
                  value={form.contactPhone}
                  onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <Label>Contact email</Label>
              <Input
                type="email"
                placeholder="contact@supplier.com"
                value={form.contactEmail}
                onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : address ? 'Update' : 'Add address'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
