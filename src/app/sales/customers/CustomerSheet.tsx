"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Users,
  CreditCard,
  Tag,
  Building2,
  Loader2,
  Pencil,
  Key,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type {
  CustomerSummary,
  CustomerAddressSummary,
  CustomerContactSummary,
  CustomerProductPricing,
  DeliveryPreferences,
} from "./types";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS } from "./types";
import {
  upsertCustomerAction,
  deleteCustomerAction,
  upsertCustomerAddressAction,
  deleteCustomerAddressAction,
  upsertCustomerContactAction,
  deleteCustomerContactAction,
  upsertCustomerProductPricingAction,
  deleteCustomerProductPricingAction,
  fetchCustomerProductPricingAction,
  updateCustomerDeliveryPreferencesAction,
  updateCustomerDefaultPriceListAction,
} from "./actions";
import { emitMutation } from "@/lib/events/mutation-events";

// =============================================================================
// TYPES
// =============================================================================

export type CustomerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  customer: CustomerSummary | null;
  priceLists: Array<{ id: string; name: string; currency: string }>;
  products: Array<{ id: string; name: string; skuCode: string | null }>;
  onSaved: () => void;
};

type TabKey = "account" | "delivery" | "payment" | "pricing" | "contacts";

type AccountFormState = {
  name: string;
  code: string;
  email: string;
  phone: string;
  vatNumber: string;
  notes: string;
  defaultPriceListId: string;
  store: string;
  accountsEmail: string;
  pricingTier: string;
  currency: string;
  countryCode: string;
  paymentTermsDays: number;
  creditLimit: number | null;
  accountCode: string;
  requiresPrePricing: boolean;
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CustomerSheet({
  open,
  onOpenChange,
  mode,
  customer,
  priceLists,
  products,
  onSaved,
}: CustomerSheetProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabKey>("account");
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(customer?.id ?? null);

  // Form state for account details
  const [form, setForm] = useState(() => getInitialForm(customer));

  function getInitialForm(c: CustomerSummary | null): AccountFormState {
    return {
      name: c?.name ?? "",
      code: c?.code ?? "",
      email: c?.email ?? "",
      phone: c?.phone ?? "",
      vatNumber: c?.vatNumber ?? "",
      notes: c?.notes ?? "",
      defaultPriceListId: c?.defaultPriceListId ?? "",
      store: c?.store ?? "",
      accountsEmail: c?.accountsEmail ?? "",
      pricingTier: c?.pricingTier ?? "",
      currency: c?.currency ?? "EUR",
      countryCode: c?.countryCode ?? "IE",
      paymentTermsDays: c?.paymentTermsDays ?? 30,
      creditLimit: c?.creditLimit ?? null,
      accountCode: c?.accountCode ?? "",
      requiresPrePricing: c?.requiresPrePricing ?? false,
    };
  }

  // Reset form whenever the sheet opens for a different customer
  useEffect(() => {
    if (open) {
      setForm(getInitialForm(customer));
      setActiveTab("account");
      setCurrentCustomerId(customer?.id ?? null);
    }
  }, [customer, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Name required" });
      return;
    }
    startTransition(async () => {
      const result = await upsertCustomerAction({
        id: customer?.id,
        name: form.name.trim(),
        code: form.code || null,
        email: form.email || null,
        phone: form.phone || null,
        vatNumber: form.vatNumber || null,
        notes: form.notes || null,
        defaultPriceListId: form.defaultPriceListId || null,
        store: form.store || null,
        accountsEmail: form.accountsEmail || null,
        pricingTier: form.pricingTier || null,
        currency: form.currency as "EUR" | "GBP",
        countryCode: form.countryCode as "IE" | "GB" | "XI" | "NL",
        paymentTermsDays: form.paymentTermsDays,
        creditLimit: form.creditLimit,
        accountCode: form.accountCode || null,
        requiresPrePricing: form.requiresPrePricing,
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed", description: result.error });
        return;
      }
      toast({ title: mode === "create" ? "Customer created" : "Customer updated" });

      // Store the new customer ID for subsequent tabs
      if (result.data?.id) {
        setCurrentCustomerId(result.data.id);
      }

      onSaved();
      if (mode === "create" && result.data?.id) {
        // Close the sheet after creation as per user request to improve UX
        onOpenChange(false);
      } else {
        onOpenChange(false);
      }
    });
  };

  const handleDelete = () => {
    if (!customer?.id) return;
    startTransition(async () => {
      const result = await deleteCustomerAction(customer.id);
      if (!result.success) {
        toast({ variant: "destructive", title: "Delete failed", description: result.error });
        return;
      }
      toast({ title: "Customer deleted" });
      onOpenChange(false);
      // Emit mutation event to trigger SWR cache invalidation
      if (result._mutated) {
        emitMutation(result._mutated);
      }
    });
  };

  const effectiveCustomerId = currentCustomerId ?? customer?.id;
  // Payment tab can be accessed without customer ID (just edits form state)
  // Delivery, Pricing, Contacts require customer ID (save separate records)
  const requiresCustomerId = !!effectiveCustomerId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? `Manage ${customer?.name}` : "Add customer"}</SheetTitle>
          <SheetDescription>
            {mode === "edit"
              ? "Update customer details, addresses, contacts, and pricing."
              : "Create a new customer record. Fill in all tabs, then save."}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
          <TabsList className="grid grid-cols-5">
            <TabsTrigger value="account" className="text-xs sm:text-sm">
              <Building2 className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="delivery" disabled={!requiresCustomerId} className="text-xs sm:text-sm">
              <MapPin className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Delivery</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="text-xs sm:text-sm">
              <CreditCard className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Payment</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" disabled={!requiresCustomerId} className="text-xs sm:text-sm">
              <Tag className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Pricing</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" disabled={!requiresCustomerId} className="text-xs sm:text-sm">
              <Users className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Contacts</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Account Details */}
          <TabsContent value="account" className="space-y-4 pt-4">
            <AccountDetailsTab
              form={form}
              setForm={setForm}
              priceLists={priceLists}
              customer={customer}
              pending={pending}
              mode={mode}
              onSubmit={handleSubmit}
              onDelete={handleDelete}
            />
          </TabsContent>

          {/* Tab 2: Delivery Addresses */}
          <TabsContent value="delivery" className="space-y-4 pt-4">
            {effectiveCustomerId ? (
              <div className="space-y-4">
                <DeliveryAddressesTab
                  customerId={effectiveCustomerId}
                  addresses={customer?.addresses ?? []}
                  onUpdated={() => emitMutation({ resource: 'customers', action: 'update', id: effectiveCustomerId })}
                />
                <DeliveryPreferencesCard
                  customerId={effectiveCustomerId}
                  initialPreferences={customer?.deliveryPreferences ?? null}
                  onUpdated={() => emitMutation({ resource: 'customers', action: 'update', id: effectiveCustomerId })}
                />
              </div>
            ) : (
              <EmptyTabState message="Save customer details first to add delivery addresses." />
            )}
          </TabsContent>

          {/* Tab 3: Payment Details */}
          <TabsContent value="payment" className="space-y-4 pt-4">
            <PaymentDetailsTab
              form={form}
              setForm={setForm}
              pending={pending}
              onSubmit={handleSubmit}
            />
          </TabsContent>

          {/* Tab 4: Pricing */}
          <TabsContent value="pricing" className="space-y-4 pt-4">
            {effectiveCustomerId ? (
              <PricingTab
                customerId={effectiveCustomerId}
                products={products}
                priceLists={priceLists}
                defaultPriceListId={form.defaultPriceListId}
                onDefaultPriceListChange={(id) => setForm((p) => ({ ...p, defaultPriceListId: id }))}
                onUpdated={() => emitMutation({ resource: 'customers', action: 'update', id: effectiveCustomerId })}
              />
            ) : (
              <EmptyTabState message="Save customer details first to configure pricing." />
            )}
          </TabsContent>

          {/* Tab 5: Contacts & Notes */}
          <TabsContent value="contacts" className="space-y-4 pt-4">
            {effectiveCustomerId ? (
              <ContactsTab
                customerId={effectiveCustomerId}
                contacts={customer?.contacts ?? []}
                notes={form.notes}
                onNotesChange={(notes) => setForm((p) => ({ ...p, notes }))}
                onUpdated={() => emitMutation({ resource: 'customers', action: 'update', id: effectiveCustomerId })}
              />
            ) : (
              <EmptyTabState message="Save customer details first to add contacts." />
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-center text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}

// =============================================================================
// TAB 1: Account Details
// =============================================================================

function AccountDetailsTab({
  form,
  setForm,
  priceLists,
  customer,
  pending,
  mode,
  onSubmit,
  onDelete,
}: {
  form: AccountFormState;
  setForm: React.Dispatch<React.SetStateAction<AccountFormState>>;
  priceLists: CustomerSheetProps["priceLists"];
  customer: CustomerSummary | null;
  pending: boolean;
  mode: "create" | "edit";
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Business Name & Code */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Business name *</Label>
          <Input
            placeholder="e.g., Garden Centre HQ"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Customer code / Reference</Label>
          <Input
            placeholder="e.g., GC-001"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
          />
        </div>
      </div>

      {/* Contact Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            placeholder="orders@example.com"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            placeholder="+353 1 234 5678"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
        </div>
      </div>

      {/* Country & VAT */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Country</Label>
          <Select
            value={form.countryCode}
            onValueChange={(v) => {
              setForm((p) => ({
                ...p,
                countryCode: v,
                currency: COUNTRY_OPTIONS.find((c) => c.code === v)?.currency ?? p.currency,
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>VAT number</Label>
          <Input
            placeholder="IE1234567X"
            value={form.vatNumber}
            onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))}
          />
        </div>
      </div>

      {/* Account Code & Store */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Account code</Label>
          <Input
            placeholder="For accounting integration"
            value={form.accountCode}
            onChange={(e) => setForm((p) => ({ ...p, accountCode: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Store / Chain</Label>
          <Input
            placeholder="e.g., Woodie's"
            value={form.store}
            onChange={(e) => setForm((p) => ({ ...p, store: e.target.value }))}
          />
        </div>
      </div>

      {/* Accounts Email */}
      <div className="space-y-2">
        <Label>Accounts email</Label>
        <Input
          type="email"
          placeholder="accounts@example.com"
          value={form.accountsEmail}
          onChange={(e) => setForm((p) => ({ ...p, accountsEmail: e.target.value }))}
        />
      </div>

      {/* Pre-Pricing Requirement */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="requiresPrePricing"
            checked={form.requiresPrePricing}
            onCheckedChange={(checked) =>
              setForm((p) => ({ ...p, requiresPrePricing: checked === true }))
            }
          />
          <Label htmlFor="requiresPrePricing" className="text-sm font-medium">
            Requires pre-pricing labels
          </Label>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-6">
          Enable if this customer requires RRP labels on their pots. Pre-pricing fee will be added to orders.
        </p>
      </div>

      {/* B2B Portal Access */}
      {mode === "edit" && customer?.id && (
        <PortalAccessSection customerId={customer.id} />
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        {mode === "edit" && customer?.id ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={pending}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{customer.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the customer and all their data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <div />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create customer" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// TAB 2: Delivery Addresses
// =============================================================================

function DeliveryAddressesTab({
  customerId,
  addresses,
  onUpdated,
}: {
  customerId: string;
  addresses: CustomerAddressSummary[];
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddressSummary | null>(null);
  const [addressType, setAddressType] = useState<'invoice' | 'delivery'>('delivery');
  const [pending, startTransition] = useTransition();

  // Separate invoice/company address from delivery addresses
  const invoiceAddress = addresses.find((a) => a.isDefaultBilling);
  const deliveryAddresses = addresses.filter((a) => !a.isDefaultBilling || a.isDefaultShipping);

  const handleAddInvoice = () => {
    setEditingAddress(null);
    setAddressType('invoice');
    setDialogOpen(true);
  };

  const handleEditInvoice = () => {
    if (invoiceAddress) {
      setEditingAddress(invoiceAddress);
      setAddressType('invoice');
      setDialogOpen(true);
    }
  };

  const handleAddDelivery = () => {
    setEditingAddress(null);
    setAddressType('delivery');
    setDialogOpen(true);
  };

  const handleEditDelivery = (address: CustomerAddressSummary) => {
    setEditingAddress(address);
    setAddressType('delivery');
    setDialogOpen(true);
  };

  const handleDelete = (addressId: string) => {
    startTransition(async () => {
      const result = await deleteCustomerAddressAction(addressId);
      if (!result.success) {
        toast({ variant: "destructive", title: "Delete failed", description: result.error });
        return;
      }
      toast({ title: "Address deleted" });
      onUpdated();
    });
  };

  return (
    <div className="space-y-6">
      {/* Company / Invoice Address Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Company / Invoice Address</CardTitle>
            </div>
            {!invoiceAddress ? (
              <Button size="sm" onClick={handleAddInvoice}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={handleEditInvoice}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
          <CardDescription>
            Head office or registered company address used for invoicing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoiceAddress ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-medium">{invoiceAddress.storeName || invoiceAddress.label}</p>
                {invoiceAddress.isDefaultShipping && (
                  <Badge variant="secondary" className="text-xs">Also delivery</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {[invoiceAddress.line1, invoiceAddress.line2].filter(Boolean).join(", ")}
              </p>
              <p className="text-sm text-muted-foreground">
                {[invoiceAddress.city, invoiceAddress.county, invoiceAddress.eircode].filter(Boolean).join(", ")}
              </p>
              {invoiceAddress.contactName && (
                <p className="text-sm text-muted-foreground">
                  Contact: {invoiceAddress.contactName}
                  {invoiceAddress.contactPhone && ` • ${invoiceAddress.contactPhone}`}
                  {invoiceAddress.contactEmail && ` • ${invoiceAddress.contactEmail}`}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No invoice address set. Add one to generate invoices.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Store / Delivery Locations Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Store / Delivery Locations</CardTitle>
            </div>
            <Button size="sm" onClick={handleAddDelivery}>
              <Plus className="mr-2 h-4 w-4" />
              Add store
            </Button>
          </div>
          <CardDescription>
            Delivery addresses for individual stores or locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deliveryAddresses.filter(a => !a.isDefaultBilling || a.isDefaultShipping).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No store locations added yet. Add delivery addresses for each store.
            </p>
          ) : (
            <div className="space-y-3">
              {deliveryAddresses
                .filter(a => !(a.isDefaultBilling && !a.isDefaultShipping)) // Don't show invoice-only addresses here
                .map((address) => (
                <div
                  key={address.id}
                  className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          {address.storeName || address.label}
                        </p>
                        {address.isDefaultShipping && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                        {address.isDefaultBilling && (
                          <Badge variant="outline" className="text-xs">Invoice</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {[address.line1, address.line2, address.city, address.county, address.eircode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {address.contactName && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Contact: {address.contactName}
                          {address.contactPhone && ` • ${address.contactPhone}`}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEditDelivery(address)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {/* Don't allow deleting if it's the only billing address */}
                      {!(address.isDefaultBilling && !deliveryAddresses.some(a => a.id !== address.id && a.isDefaultBilling)) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(address.id)}
                          disabled={pending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerId={customerId}
        address={editingAddress}
        addressType={addressType}
        onSaved={onUpdated}
      />
    </div>
  );
}

function AddressDialog({
  open,
  onOpenChange,
  customerId,
  address,
  addressType = 'delivery',
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  address: CustomerAddressSummary | null;
  addressType?: 'invoice' | 'delivery';
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    label: "",
    storeName: "",
    line1: "",
    line2: "",
    city: "",
    county: "",
    eircode: "",
    countryCode: "IE",
    isDefaultShipping: false,
    isDefaultBilling: false,
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  const isInvoiceMode = addressType === 'invoice';

  useEffect(() => {
    if (open) {
      if (address) {
        setForm({
          label: address.label,
          storeName: address.storeName ?? "",
          line1: address.line1,
          line2: address.line2 ?? "",
          city: address.city ?? "",
          county: address.county ?? "",
          eircode: address.eircode ?? "",
          countryCode: address.countryCode,
          isDefaultShipping: address.isDefaultShipping,
          isDefaultBilling: address.isDefaultBilling,
          contactName: address.contactName ?? "",
          contactEmail: address.contactEmail ?? "",
          contactPhone: address.contactPhone ?? "",
        });
      } else {
        // Set defaults based on address type
        setForm({
          label: "",
          storeName: "",
          line1: "",
          line2: "",
          city: "",
          county: "",
          eircode: "",
          countryCode: "IE",
          isDefaultShipping: isInvoiceMode ? true : false, // Invoice address often also used for delivery
          isDefaultBilling: isInvoiceMode ? true : false,
          contactName: "",
          contactEmail: "",
          contactPhone: "",
        });
      }
    }
  }, [open, address, isInvoiceMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.line1.trim()) {
      toast({ variant: "destructive", title: "Address line 1 is required" });
      return;
    }
    startTransition(async () => {
      const result = await upsertCustomerAddressAction({
        id: address?.id,
        customerId,
        label: form.storeName || form.label || (isInvoiceMode ? "Head Office" : "Address"),
        storeName: form.storeName || null,
        line1: form.line1,
        line2: form.line2 || null,
        city: form.city || null,
        county: form.county || null,
        eircode: form.eircode || null,
        countryCode: form.countryCode,
        isDefaultShipping: form.isDefaultShipping,
        isDefaultBilling: isInvoiceMode ? true : form.isDefaultBilling,
        contactName: form.contactName || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed", description: result.error });
        return;
      }
      toast({ title: address ? "Address updated" : "Address added" });
      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {address 
              ? (isInvoiceMode ? "Edit invoice address" : "Edit store address")
              : (isInvoiceMode ? "Add invoice address" : "Add store / delivery address")
            }
          </DialogTitle>
          <DialogDescription>
            {isInvoiceMode 
              ? "Company or head office address used for invoicing."
              : "Store location where deliveries will be made."
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{isInvoiceMode ? "Company / Office name" : "Store / Location name"}</Label>
            <Input
              placeholder={isInvoiceMode ? "e.g., Head Office, Registered Office" : "e.g., Woodies Sandyford"}
              value={form.storeName}
              onChange={(e) => setForm((p) => ({ ...p, storeName: e.target.value }))}
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
              placeholder="Building, floor, etc."
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
              <Label>County</Label>
              <Input
                value={form.county}
                onChange={(e) => setForm((p) => ({ ...p, county: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>Eircode / Postcode</Label>
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

          {/* Address Type Options */}
          {isInvoiceMode ? (
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="alsoDelivery"
                  checked={form.isDefaultShipping}
                  onCheckedChange={(checked) =>
                    setForm((p) => ({ ...p, isDefaultShipping: checked === true }))
                  }
                />
                <Label htmlFor="alsoDelivery" className="text-sm">
                  Also use this address for deliveries
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Enable if deliveries go to the same address as invoices
              </p>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="defaultShipping"
                  checked={form.isDefaultShipping}
                  onCheckedChange={(checked) =>
                    setForm((p) => ({ ...p, isDefaultShipping: checked === true }))
                  }
                />
                <Label htmlFor="defaultShipping" className="text-sm">
                  Default delivery location
                </Label>
              </div>
            </div>
          )}

          <div className="border-t pt-4 mt-4">
            <h5 className="font-medium mb-3">{isInvoiceMode ? "Accounts Contact" : "Store Contact"}</h5>
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
                placeholder="john@example.com"
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
              {pending 
                ? "Saving..." 
                : address 
                  ? "Update" 
                  : isInvoiceMode 
                    ? "Save invoice address" 
                    : "Add store"
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeliveryPreferencesCard({
  customerId,
  initialPreferences,
  onUpdated,
}: {
  customerId: string;
  initialPreferences: DeliveryPreferences | null;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [prefs, setPrefs] = useState<DeliveryPreferences>({
    preferredTrolleyType: initialPreferences?.preferredTrolleyType ?? undefined,
    labelRequirements: initialPreferences?.labelRequirements ?? undefined,
    specialInstructions: initialPreferences?.specialInstructions ?? undefined,
  });

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateCustomerDeliveryPreferencesAction({
        customerId,
        preferences: {
          preferredTrolleyType: prefs.preferredTrolleyType || null,
          labelRequirements: prefs.labelRequirements || null,
          specialInstructions: prefs.specialInstructions || null,
        },
      });

      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed", description: result.error });
        return;
      }

      toast({ title: "Delivery preferences saved" });
      onUpdated();
      // Mutation event emitted by onUpdated callback
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Delivery Preferences</CardTitle>
        <CardDescription>
          Capture customer-specific requirements such as trolley type and tagging.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Preferred trolley type</Label>
            <Select
              value={prefs.preferredTrolleyType ?? ""}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, preferredTrolleyType: (v as DeliveryPreferences['preferredTrolleyType']) || undefined }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tag6">Tag 6 (Yellow)</SelectItem>
                <SelectItem value="dc">No Tag (DC)</SelectItem>
                <SelectItem value="danish">Danish</SelectItem>
                <SelectItem value="dutch">Dutch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Label requirements</Label>
            <Select
              value={prefs.labelRequirements ?? ""}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, labelRequirements: (v as DeliveryPreferences['labelRequirements']) || undefined }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yellow_tag">Yellow tag only</SelectItem>
                <SelectItem value="no_tag">No tags</SelectItem>
                <SelectItem value="any">Any</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Special instructions</Label>
          <Textarea
            placeholder="E.g., stack on Danish, no barcodes on plants"
            value={prefs.specialInstructions ?? ""}
            onChange={(e) => setPrefs((p) => ({ ...p, specialInstructions: e.target.value || undefined }))}
            rows={3}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Saving..." : "Save preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// TAB 3: Payment Details
// =============================================================================

function PaymentDetailsTab({
  form,
  setForm,
  pending,
  onSubmit,
}: {
  form: AccountFormState;
  setForm: React.Dispatch<React.SetStateAction<AccountFormState>>;
  pending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={form.currency}
            onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Payment terms (days)</Label>
          <Input
            type="number"
            min="0"
            value={form.paymentTermsDays}
            onChange={(e) =>
              setForm((p) => ({ ...p, paymentTermsDays: parseInt(e.target.value) || 0 }))
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Credit limit</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="No limit"
            value={form.creditLimit ?? ""}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                creditLimit: e.target.value ? parseFloat(e.target.value) : null,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Pricing tier</Label>
          <Input
            placeholder="e.g., A, B, C"
            value={form.pricingTier}
            onChange={(e) => setForm((p) => ({ ...p, pricingTier: e.target.value }))}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-muted/50">
        <h5 className="font-medium mb-2">VAT Treatment</h5>
        <p className="text-sm text-muted-foreground">
          {form.countryCode === "IE" && "Standard Irish VAT rates apply."}
          {form.countryCode === "GB" &&
            (form.vatNumber
              ? "Zero-rated B2B export to UK (VAT number provided)."
              : "Export to UK - VAT may apply.")}
          {form.countryCode === "XI" && "Northern Ireland - EU goods rules apply."}
          {form.countryCode === "NL" &&
            (form.vatNumber
              ? "Reverse charge - customer accounts for VAT."
              : "Export to Netherlands - VAT may apply.")}
        </p>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// TAB 4: Pricing
// =============================================================================

function PricingTab({
  customerId,
  products,
  priceLists,
  defaultPriceListId,
  onDefaultPriceListChange,
  onUpdated,
}: {
  customerId: string;
  products: CustomerSheetProps["products"];
  priceLists: CustomerSheetProps["priceLists"];
  defaultPriceListId: string;
  onDefaultPriceListChange: (id: string) => void;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [pricing, setPricing] = useState<CustomerProductPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<CustomerProductPricing | null>(null);
  const [pending, startTransition] = useTransition();

  // Fetch customer-specific pricing
  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await fetchCustomerProductPricingAction(customerId);
      if (result.success && result.data) {
        setPricing(result.data as CustomerProductPricing[]);
      }
      setLoading(false);
    }
    load();
  }, [customerId]);

  const handleAddNew = () => {
    setEditingPricing(null);
    setDialogOpen(true);
  };

  const handleEdit = (p: CustomerProductPricing) => {
    setEditingPricing(p);
    setDialogOpen(true);
  };

  const handleDelete = (aliasId: string) => {
    startTransition(async () => {
      const result = await deleteCustomerProductPricingAction(aliasId);
      if (!result.success) {
        toast({ variant: "destructive", title: "Delete failed", description: result.error });
        return;
      }
      toast({ title: "Pricing removed" });
      setPricing((prev) => prev.filter((p) => p.aliasId !== aliasId));
      onUpdated();
    });
  };

  const handleSaveDefaultPriceList = () => {
    startTransition(async () => {
      const result = await updateCustomerDefaultPriceListAction(
        customerId,
        defaultPriceListId || null
      );
      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed" });
        return;
      }
      toast({ title: "Default price list updated" });
      onUpdated();
    });
  };

  return (
    <div className="space-y-6">
      {/* Default Price List */}
      <div className="space-y-2">
        <Label>Default price list</Label>
        <div className="flex gap-2">
          <Select
            value={defaultPriceListId || "__none__"}
            onValueChange={(v) => onDefaultPriceListChange(v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select price list" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No default</SelectItem>
              {priceLists.map((pl) => (
                <SelectItem key={pl.id} value={pl.id}>
                  {pl.name} ({pl.currency})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={handleSaveDefaultPriceList} disabled={pending}>
            Save
          </Button>
        </div>
      </div>

      {/* Customer Product Pricing Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Customer-specific pricing</h4>
          <Button size="sm" onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add product pricing
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pricing.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No custom product pricing set. Products will use the default price list.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Customer SKU</TableHead>
                <TableHead className="text-right">Your Price</TableHead>
                <TableHead className="text-right">RRP</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricing.map((p) => (
                <TableRow key={p.aliasId}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{p.productName}</p>
                      {p.skuCode && (
                        <p className="text-xs text-muted-foreground">{p.skuCode}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{p.customerSkuCode || "—"}</TableCell>
                  <TableCell className="text-right">
                    {p.unitPriceExVat != null ? `€${p.unitPriceExVat.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.rrp != null ? `€${p.rrp.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(p.aliasId)}
                        disabled={pending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ProductPricingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerId={customerId}
        pricing={editingPricing}
        products={products}
        existingProductIds={pricing.map((p) => p.productId)}
        onSaved={() => {
          // Refresh pricing
          fetchCustomerProductPricingAction(customerId).then((result) => {
            if (result.success && result.data) setPricing(result.data as CustomerProductPricing[]);
          });
          onUpdated();
        }}
      />
    </div>
  );
}

function ProductPricingDialog({
  open,
  onOpenChange,
  customerId,
  pricing,
  products,
  existingProductIds,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  pricing: CustomerProductPricing | null;
  products: CustomerSheetProps["products"];
  existingProductIds: string[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    productId: "",
    customerSkuCode: "",
    unitPriceExVat: "",
    rrp: "",
    notes: "",
  });

  const availableProducts = useMemo(() => {
    if (pricing) return products; // When editing, show all
    return products.filter((p) => !existingProductIds.includes(p.id));
  }, [products, existingProductIds, pricing]);

  useEffect(() => {
    if (open) {
      if (pricing) {
        setForm({
          productId: pricing.productId,
          customerSkuCode: pricing.customerSkuCode ?? "",
          unitPriceExVat: pricing.unitPriceExVat?.toString() ?? "",
          rrp: pricing.rrp?.toString() ?? "",
          notes: pricing.notes ?? "",
        });
      } else {
        setForm({
          productId: "",
          customerSkuCode: "",
          unitPriceExVat: "",
          rrp: "",
          notes: "",
        });
      }
    }
  }, [open, pricing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId) {
      toast({ variant: "destructive", title: "Please select a product" });
      return;
    }
    startTransition(async () => {
      const result = await upsertCustomerProductPricingAction({
        id: pricing?.aliasId,
        customerId,
        productId: form.productId,
        customerSkuCode: form.customerSkuCode || null,
        unitPriceExVat: form.unitPriceExVat ? parseFloat(form.unitPriceExVat) : null,
        rrp: form.rrp ? parseFloat(form.rrp) : null,
        notes: form.notes || null,
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed", description: result.error });
        return;
      }
      toast({ title: pricing ? "Pricing updated" : "Pricing added" });
      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pricing ? "Edit pricing" : "Add product pricing"}</DialogTitle>
          <DialogDescription>
            Set customer-specific pricing and RRP for labeling.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Product *</Label>
            <Select
              value={form.productId}
              onValueChange={(v) => setForm((p) => ({ ...p, productId: v }))}
              disabled={!!pricing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {availableProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                    {product.skuCode && ` (${product.skuCode})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Customer SKU code</Label>
            <Input
              placeholder="e.g., CUST-LAV-001"
              value={form.customerSkuCode}
              onChange={(e) => setForm((p) => ({ ...p, customerSkuCode: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>Your price (ex VAT)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.unitPriceExVat}
                onChange={(e) => setForm((p) => ({ ...p, unitPriceExVat: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>RRP (for labels)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.rrp}
                onChange={(e) => setForm((p) => ({ ...p, rrp: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Internal notes..."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : pricing ? "Update" : "Add pricing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// TAB 5: Contacts & Notes
// =============================================================================

function ContactsTab({
  customerId,
  contacts,
  notes,
  onNotesChange,
  onUpdated,
}: {
  customerId: string;
  contacts: CustomerContactSummary[];
  notes: string;
  onNotesChange: (notes: string) => void;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContactSummary | null>(null);
  const [pending, startTransition] = useTransition();

  const handleAddNew = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const handleEdit = (contact: CustomerContactSummary) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleDelete = (contactId: string) => {
    startTransition(async () => {
      const result = await deleteCustomerContactAction(contactId);
      if (!result.success) {
        toast({ variant: "destructive", title: "Delete failed", description: result.error });
        return;
      }
      toast({ title: "Contact deleted" });
      onUpdated();
    });
  };

  const handleSaveNotes = () => {
    startTransition(async () => {
      const result = await upsertCustomerAction({
        id: customerId,
        name: "",
        notes: notes || null,
        currency: "EUR",
        countryCode: "IE",
        paymentTermsDays: 30,
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed" });
        return;
      }
      toast({ title: "Notes saved" });
      onUpdated();
    });
  };

  return (
    <div className="space-y-6">
      {/* Contacts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Company Contacts</h4>
          <Button size="sm" onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add contact
          </Button>
        </div>

        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No contacts added yet.
          </p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-lg border p-4 flex items-start justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{contact.name}</p>
                    {contact.isPrimary && (
                      <Badge variant="secondary" className="text-xs">Primary</Badge>
                    )}
                    {contact.role && (
                      <Badge variant="outline" className="text-xs">{contact.role}</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:underline">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:underline">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </a>
                    )}
                    {contact.mobile && (
                      <a href={`tel:${contact.mobile}`} className="flex items-center gap-1 hover:underline">
                        <Phone className="h-3 w-3" />
                        {contact.mobile} (mobile)
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(contact)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(contact.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2 border-t pt-6">
        <Label>Internal Notes</Label>
        <Textarea
          rows={4}
          placeholder="Internal notes about this customer..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
        <div className="flex justify-end">
          <Button variant="secondary" onClick={handleSaveNotes} disabled={pending}>
            Save notes
          </Button>
        </div>
      </div>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerId={customerId}
        contact={editingContact}
        onSaved={onUpdated}
      />
    </div>
  );
}

function ContactDialog({
  open,
  onOpenChange,
  customerId,
  contact,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  contact: CustomerContactSummary | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    mobile: "",
    role: "",
    isPrimary: false,
  });

  useEffect(() => {
    if (open) {
      if (contact) {
        setForm({
          name: contact.name,
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          mobile: contact.mobile ?? "",
          role: contact.role ?? "",
          isPrimary: contact.isPrimary,
        });
      } else {
        setForm({
          name: "",
          email: "",
          phone: "",
          mobile: "",
          role: "",
          isPrimary: false,
        });
      }
    }
  }, [open, contact]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Contact name is required" });
      return;
    }
    startTransition(async () => {
      const result = await upsertCustomerContactAction({
        id: contact?.id,
        customerId,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        mobile: form.mobile || null,
        role: form.role || null,
        isPrimary: form.isPrimary,
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed", description: result.error });
        return;
      }
      toast({ title: contact ? "Contact updated" : "Contact added" });
      onOpenChange(false);
      onSaved();
    });
  };

  const roleOptions = ["Owner", "Manager", "Accounts", "Buyer", "Other"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
          <DialogDescription>
            {contact ? "Update the contact details." : "Add a new company contact."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="John Smith"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="john@example.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                placeholder="+353 1 234 5678"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input
                placeholder="+353 86 123 4567"
                value={form.mobile}
                onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isPrimary"
              checked={form.isPrimary}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, isPrimary: checked === true }))
              }
            />
            <Label htmlFor="isPrimary" className="text-sm">
              Primary contact
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : contact ? "Update" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// PORTAL ACCESS SECTION
// =============================================================================

function PortalAccessSection({ customerId }: { customerId: string }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [portalEmail, setPortalEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleCreatePortalAccess = () => {
    if (!portalEmail.trim() || !portalPassword.trim()) {
      toast({
        variant: "destructive",
        title: "Email and password required",
        description: "Please enter both email and password for portal access",
      });
      return;
    }

    startTransition(async () => {
      // Import the action dynamically
      const { setCustomerPortalPassword } = await import("./actions");
      const result = await setCustomerPortalPassword({
        customerId,
        email: portalEmail,
        password: portalPassword,
      });

      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Failed to create portal access",
          description: result.error,
        });
        return;
      }

      toast({
        title: "Portal access created",
        description: `Customer can now log in to the B2B portal with ${portalEmail}`,
      });

      setPortalEmail("");
      setPortalPassword("");
      setShowPassword(false);
    });
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center gap-2">
        <Key className="h-5 w-5" />
        <h5 className="font-medium">B2B Portal Access</h5>
      </div>
      <p className="text-sm text-muted-foreground">
        Set up login credentials for this customer to access the B2B portal.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Portal email</Label>
          <Input
            type="email"
            placeholder="customer@example.com"
            value={portalEmail}
            onChange={(e) => setPortalEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Portal password</Label>
          <div className="flex gap-2">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={portalPassword}
              onChange={(e) => setPortalPassword(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </Button>
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={handleCreatePortalAccess}
        disabled={pending}
      >
        {pending ? "Creating..." : "Create portal access"}
      </Button>
    </div>
  );
}
