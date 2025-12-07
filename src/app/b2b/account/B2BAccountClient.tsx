'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, MapPin, User, Mail, Phone } from 'lucide-react';
import type { Database } from '@/types/supabase';

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerAddress = Database['public']['Tables']['customer_addresses']['Row'];
type CustomerContact = Database['public']['Tables']['customer_contacts']['Row'];

type B2BAccountClientProps = {
  customer: Customer;
  user: {
    id: string;
    email?: string;
  };
  addresses: CustomerAddress[];
  contacts: CustomerContact[];
};

export function B2BAccountClient({ customer, user, addresses, contacts }: B2BAccountClientProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          View your account information and delivery addresses
        </p>
      </div>

      {/* Customer Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            <CardTitle>Company Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Company Name</p>
            <p className="font-medium">{customer.name}</p>
          </div>
          {customer.code && (
            <div>
              <p className="text-sm text-muted-foreground">Customer Code</p>
              <p className="font-medium">{customer.code}</p>
            </div>
          )}
          {customer.email && (
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{customer.email}</p>
            </div>
          )}
          {customer.phone && (
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{customer.phone}</p>
            </div>
          )}
          {customer.vat_number && (
            <div>
              <p className="text-sm text-muted-foreground">VAT Number</p>
              <p className="font-medium">{customer.vat_number}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Currency</p>
            <p className="font-medium">{customer.currency || 'EUR'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Country</p>
            <p className="font-medium">{customer.country_code || 'IE'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Login Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Login Information</CardTitle>
          </div>
          <CardDescription>Your portal login credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            To change your password or update login details, please contact us.
          </p>
        </CardContent>
      </Card>

      {/* Delivery Addresses */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <CardTitle>Delivery Addresses</CardTitle>
          </div>
          <CardDescription>Your registered delivery locations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No addresses on file.</p>
          ) : (
            addresses.map((address) => (
              <div
                key={address.id}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{address.label}</p>
                    {address.store_name && (
                      <p className="text-sm text-muted-foreground">{address.store_name}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {address.is_default_shipping && (
                      <Badge variant="secondary">Default Shipping</Badge>
                    )}
                    {address.is_default_billing && (
                      <Badge variant="outline">Default Billing</Badge>
                    )}
                  </div>
                </div>
                <div className="text-sm">
                  <p>{address.line1}</p>
                  {address.line2 && <p>{address.line2}</p>}
                  <p>
                    {address.city}
                    {address.county && `, ${address.county}`}
                  </p>
                  {address.eircode && <p>{address.eircode}</p>}
                  <p>{address.country_code}</p>
                </div>
                {(address.contact_name || address.contact_email || address.contact_phone) && (
                  <div className="mt-3 pt-3 border-t text-sm">
                    {address.contact_name && (
                      <p className="font-medium">{address.contact_name}</p>
                    )}
                    {address.contact_email && (
                      <p className="text-muted-foreground">{address.contact_email}</p>
                    )}
                    {address.contact_phone && (
                      <p className="text-muted-foreground">{address.contact_phone}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          <p className="text-sm text-muted-foreground">
            To add or modify delivery addresses, please contact us.
          </p>
        </CardContent>
      </Card>

      {/* Contacts */}
      {contacts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Contacts</CardTitle>
            </div>
            <CardDescription>Your company contacts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-3 rounded-lg border bg-card flex items-start justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{contact.name}</p>
                    {contact.is_primary && (
                      <Badge variant="secondary" className="text-xs">Primary</Badge>
                    )}
                  </div>
                  {contact.role && (
                    <p className="text-sm text-muted-foreground">{contact.role}</p>
                  )}
                  <div className="flex flex-col gap-1 text-sm">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </div>
                    )}
                    {contact.mobile && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {contact.mobile} (Mobile)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
