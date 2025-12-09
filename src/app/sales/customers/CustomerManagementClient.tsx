"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Settings2,
  Mail,
  Phone,
  MapPin,
  Users,
  CreditCard,
  Tag,
  FileText,
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
  CustomerManagementPayload,
  CustomerSummary,
  CustomerAddressSummary,
  CustomerContactSummary,
  CustomerProductPricing,
} from "./types";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS } from "./types";
import { DataPageShell } from "@/components/data-management/DataPageShell";
import { DataToolbar } from "@/components/data-management/DataToolbar";
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
} from "./actions";

type Props = CustomerManagementPayload;

export default function CustomerManagementClient({ customers, priceLists, products }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [filterText, setFilterText] = useState("");
  const priceListNameMap = useMemo(
    () => new Map(priceLists.map((pl) => [pl.name.toLowerCase(), pl.id])),
    [priceLists]
  );

  const filteredCustomers = useMemo(() => {
    if (!filterText) return customers;
    const q = filterText.toLowerCase();
    return customers.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.store?.toLowerCase().includes(q) ||
        c.countryCode?.toLowerCase().includes(q)
      );
    });
  }, [customers, filterText]);

  const handleCreate = () => {
    setSheetMode("create");
    setSelectedCustomer(null);
    setSheetOpen(true);
  };

  const handleEdit = (customer: CustomerSummary) => {
    setSheetMode("edit");
    setSelectedCustomer(customer);
    setSheetOpen(true);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      // Basic info
      "name",
      "code",
      "email",
      "phone",
      "store",
      "accountsEmail",
      // Country & VAT
      "countryCode",
      "vatNumber",
      "currency",
      // Payment
      "paymentTermsDays",
      "creditLimit",
      "pricingTier",
      "accountCode",
      "defaultPriceList",
      // Delivery address (optional)
      "deliveryStoreName",
      "deliveryLine1",
      "deliveryLine2",
      "deliveryCity",
      "deliveryCounty",
      "deliveryEircode",
      "deliveryCountryCode",
      "deliveryContactName",
      "deliveryContactPhone",
      "deliveryContactEmail",
      // Contact (optional)
      "contactName",
      "contactRole",
      "contactEmail",
      "contactPhone",
      "contactMobile",
      // Notes
      "notes",
    ];
    const sample1 = [
      // Basic info
      "Garden Centre HQ",
      "GC-001",
      "orders@gardencentrehq.ie",
      "+3531234567",
      "Woodie's",
      "accounts@gardencentrehq.ie",
      // Country & VAT
      "IE",
      "IE1234567X",
      "EUR",
      // Payment
      "30",
      "10000",
      "Tier A",
      "4000",
      priceLists[0]?.name ?? "Wholesale 2025",
      // Delivery address
      "Head Office",
      "Unit 1 Business Park",
      "",
      "Dublin",
      "Dublin",
      "D01 AB12",
      "IE",
      "John Smith",
      "+3531234568",
      "john@gardencentrehq.ie",
      // Contact
      "Mary Jones",
      "Buyer",
      "mary@gardencentrehq.ie",
      "+3531234569",
      "+353861234567",
      // Notes
      "Prefers deliveries on Mondays",
    ];
    const sample2 = [
      // UK customer example
      "British Garden Supplies",
      "BGS-001",
      "orders@britishgarden.co.uk",
      "+441onal234567",
      "",
      "accounts@britishgarden.co.uk",
      // Country & VAT
      "GB",
      "GB123456789",
      "GBP",
      // Payment
      "45",
      "",
      "Tier B",
      "4100",
      priceLists[0]?.name ?? "",
      // Delivery address
      "Main Warehouse",
      "123 Industrial Estate",
      "Building C",
      "Manchester",
      "Greater Manchester",
      "M1 1AA",
      "GB",
      "David Brown",
      "+441onal234568",
      "",
      // Contact
      "Sarah Wilson",
      "Owner",
      "sarah@britishgarden.co.uk",
      "+441onal234560",
      "",
      // Notes
      "UK export - zero-rated VAT",
    ];
    downloadCsv(headers, [sample1, sample2], "customers_template.csv");
  };

  const handleDownloadData = () => {
    const headers = [
      // Basic info
      "name",
      "code",
      "email",
      "phone",
      "store",
      "accountsEmail",
      // Country & VAT
      "countryCode",
      "vatNumber",
      "currency",
      // Payment
      "paymentTermsDays",
      "creditLimit",
      "pricingTier",
      "accountCode",
      "defaultPriceList",
      // Primary delivery address
      "deliveryStoreName",
      "deliveryLine1",
      "deliveryLine2",
      "deliveryCity",
      "deliveryCounty",
      "deliveryEircode",
      "deliveryCountryCode",
      "deliveryContactName",
      "deliveryContactPhone",
      "deliveryContactEmail",
      // Primary contact
      "contactName",
      "contactRole",
      "contactEmail",
      "contactPhone",
      "contactMobile",
      // Notes
      "notes",
      // Metadata
      "addressCount",
      "contactCount",
    ];
    const rows = filteredCustomers.map((customer) => {
      // Get default shipping address or first address
      const primaryAddress = customer.addresses.find(a => a.isDefaultShipping) ?? customer.addresses[0];
      // Get primary contact or first contact
      const primaryContact = customer.contacts.find(c => c.isPrimary) ?? customer.contacts[0];

      return [
        // Basic info
        customer.name ?? "",
        customer.code ?? "",
        customer.email ?? "",
        customer.phone ?? "",
        customer.store ?? "",
        customer.accountsEmail ?? "",
        // Country & VAT
        customer.countryCode ?? "",
        customer.vatNumber ?? "",
        customer.currency ?? "",
        // Payment
        String(customer.paymentTermsDays ?? 30),
        customer.creditLimit != null ? String(customer.creditLimit) : "",
        customer.pricingTier ?? "",
        customer.accountCode ?? "",
        customer.defaultPriceListName ?? "",
        // Primary delivery address
        primaryAddress?.storeName ?? "",
        primaryAddress?.line1 ?? "",
        primaryAddress?.line2 ?? "",
        primaryAddress?.city ?? "",
        primaryAddress?.county ?? "",
        primaryAddress?.eircode ?? "",
        primaryAddress?.countryCode ?? "",
        primaryAddress?.contactName ?? "",
        primaryAddress?.contactPhone ?? "",
        primaryAddress?.contactEmail ?? "",
        // Primary contact
        primaryContact?.name ?? "",
        primaryContact?.role ?? "",
        primaryContact?.email ?? "",
        primaryContact?.phone ?? "",
        primaryContact?.mobile ?? "",
        // Notes
        customer.notes ?? "",
        // Metadata
        String(customer.addresses.length),
        String(customer.contacts.length),
      ];
    });
    downloadCsv(headers, rows, "customers.csv");
  };

  const handleUploadCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
    if (!lines.length) {
      throw new Error("The CSV file is empty.");
    }

    const headerLine = lines.shift()!;
    const headers = parseCsvRow(headerLine).map((header) => header.toLowerCase().replace(/\s+/g, ""));
    if (!headers.includes("name")) {
      throw new Error('CSV must include a "name" column.');
    }

    let created = 0;
    let addressesCreated = 0;
    let contactsCreated = 0;
    const failures: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const values = parseCsvRow(line);
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ?? "";
      });

      const name = record["name"]?.trim();
      if (!name) {
        failures.push("(missing name)");
        continue;
      }

      // Resolve price list
      const priceListValue =
        record["defaultpricelistid"] || record["defaultpricelist"] || "";
      let defaultPriceListId: string | undefined;
      if (priceListValue) {
        const byId = priceLists.find((pl) => pl.id === priceListValue);
        if (byId) {
          defaultPriceListId = byId.id;
        } else {
          const byName = priceListNameMap.get(priceListValue.toLowerCase());
          if (byName) {
            defaultPriceListId = byName;
          }
        }
      }

      // Create/update customer
      const result = await upsertCustomerAction({
        name,
        code: record["code"] || null,
        email: record["email"] || null,
        phone: record["phone"] || null,
        vatNumber: record["vatnumber"] || null,
        notes: record["notes"] || null,
        store: record["store"] || null,
        accountsEmail: record["accountsemail"] || null,
        pricingTier: record["pricingtier"] || null,
        defaultPriceListId: defaultPriceListId ?? null,
        countryCode: (record["countrycode"] as "IE" | "GB" | "XI" | "NL") || "IE",
        currency: (record["currency"] as "EUR" | "GBP") || "EUR",
        paymentTermsDays: parseInt(record["paymenttermsdays"]) || 30,
        creditLimit: record["creditlimit"] ? parseFloat(record["creditlimit"]) : null,
        accountCode: record["accountcode"] || null,
      });

      if (!result.success) {
        failures.push(name);
        continue;
      }

      created += 1;
      const customerId = result.data?.id;

      // Create delivery address if provided
      if (customerId && record["deliveryline1"]) {
        const addrResult = await upsertCustomerAddressAction({
          customerId,
          label: record["deliverystorename"] || "Main",
          storeName: record["deliverystorename"] || null,
          line1: record["deliveryline1"],
          line2: record["deliveryline2"] || null,
          city: record["deliverycity"] || null,
          county: record["deliverycounty"] || null,
          eircode: record["deliveryeircode"] || null,
          countryCode: record["deliverycountrycode"] || record["countrycode"] || "IE",
          isDefaultShipping: true,
          isDefaultBilling: true,
          contactName: record["deliverycontactname"] || null,
          contactEmail: record["deliverycontactemail"] || null,
          contactPhone: record["deliverycontactphone"] || null,
        });
        if (addrResult.success) addressesCreated += 1;
      }

      // Create contact if provided
      if (customerId && record["contactname"]) {
        const contactResult = await upsertCustomerContactAction({
          customerId,
          name: record["contactname"],
          email: record["contactemail"] || null,
          phone: record["contactphone"] || null,
          mobile: record["contactmobile"] || null,
          role: record["contactrole"] || null,
          isPrimary: true,
        });
        if (contactResult.success) contactsCreated += 1;
      }
    }

    const parts = [`${created} customer${created === 1 ? "" : "s"} imported`];
    if (addressesCreated > 0) parts.push(`${addressesCreated} address${addressesCreated === 1 ? "" : "es"}`);
    if (contactsCreated > 0) parts.push(`${contactsCreated} contact${contactsCreated === 1 ? "" : "s"}`);
    if (failures.length > 0) parts.push(`${failures.length} failed`);

    toast({
      title: "Import complete",
      description: parts.join(", ") + ".",
      variant: failures.length ? "destructive" : "default",
    });
    router.refresh();
  };

  const filters = (
    <Input
      className="w-full max-w-sm"
      placeholder="Filter by name, code, email, country…"
      value={filterText}
      onChange={(e) => setFilterText(e.target.value)}
    />
  );

  return (
    <DataPageShell
      title="Customers"
      description="Manage buyer details, addresses, contacts, and pricing."
      heroActions={
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add customer
        </Button>
      }
      toolbar={
        <DataToolbar
          onDownloadTemplate={handleDownloadTemplate}
          onDownloadData={handleDownloadData}
          onUploadCsv={handleUploadCsv}
          filters={filters}
        />
      }
      backHref="/sales"
    >
      <Card>
        <CardHeader>
          <CardTitle>Customer directory</CardTitle>
          <CardDescription>
            {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No customers found. Use the import tools or click "Add customer".</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Addresses</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.code || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        {customer.email && (
                          <a
                            className="flex items-center gap-1 text-muted-foreground hover:underline"
                            href={`mailto:${customer.email}`}
                          >
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </a>
                        )}
                        {customer.phone && (
                          <a
                            className="flex items-center gap-1 text-muted-foreground hover:underline"
                            href={`tel:${customer.phone}`}
                          >
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </a>
                        )}
                        {!customer.email && !customer.phone && "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {COUNTRY_OPTIONS.find((c) => c.code === customer.countryCode)?.name ?? customer.countryCode}
                      </Badge>
                    </TableCell>
                    <TableCell>{customer.currency}</TableCell>
                    <TableCell>
                      {customer.addresses.length > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {customer.addresses.length} location{customer.addresses.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(customer)}>
                        <Settings2 className="mr-2 h-4 w-4" />
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CustomerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        customer={selectedCustomer}
        priceLists={priceLists}
        products={products}
        onSaved={() => {
          router.refresh();
        }}
      />
    </DataPageShell>
  );
}

// =============================================================================
// CUSTOMER SHEET (5 Tabs)
// =============================================================================

type CustomerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  customer: CustomerSummary | null;
  priceLists: Props["priceLists"];
  products: Props["products"];
  onSaved: () => void;
};

type TabKey = "account" | "delivery" | "payment" | "pricing" | "contacts";

function CustomerSheet({
  open,
  onOpenChange,
  mode,
  customer,
  priceLists,
  products,
  onSaved,
}: CustomerSheetProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabKey>("account");
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(customer?.id ?? null);

  // Form state for account details
  const [form, setForm] = useState(() => getInitialForm(customer));

  function getInitialForm(c: CustomerSummary | null) {
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
      router.refresh();
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
              <DeliveryAddressesTab
                customerId={effectiveCustomerId}
                addresses={customer?.addresses ?? []}
                onUpdated={() => router.refresh()}
              />
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
                onUpdated={() => router.refresh()}
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
                onUpdated={() => router.refresh()}
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
};

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
  priceLists: Props["priceLists"];
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
  const [pending, startTransition] = useTransition();

  const handleAddNew = () => {
    setEditingAddress(null);
    setDialogOpen(true);
  };

  const handleEdit = (address: CustomerAddressSummary) => {
    setEditingAddress(address);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Delivery Locations</h4>
        <Button size="sm" onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No delivery addresses added yet.
        </p>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="rounded-lg border p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {address.storeName || address.label}
                    </p>
                    {address.isDefaultShipping && (
                      <Badge variant="secondary" className="text-xs">Default Shipping</Badge>
                    )}
                    {address.isDefaultBilling && (
                      <Badge variant="outline" className="text-xs">Billing</Badge>
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
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(address)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(address.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerId={customerId}
        address={editingAddress}
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
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  address: CustomerAddressSummary | null;
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
        setForm({
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
      }
    }
  }, [open, address]);

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
        label: form.storeName || form.label || "Address",
        storeName: form.storeName || null,
        line1: form.line1,
        line2: form.line2 || null,
        city: form.city || null,
        county: form.county || null,
        eircode: form.eircode || null,
        countryCode: form.countryCode,
        isDefaultShipping: form.isDefaultShipping,
        isDefaultBilling: form.isDefaultBilling,
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
          <DialogTitle>{address ? "Edit address" : "Add address"}</DialogTitle>
          <DialogDescription>
            {address ? "Update the delivery address details." : "Add a new delivery location."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Store / Location name</Label>
            <Input
              placeholder="e.g., Woodies Sandyford"
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
              placeholder="Apartment, suite, etc."
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
                Default shipping
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="defaultBilling"
                checked={form.isDefaultBilling}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, isDefaultBilling: checked === true }))
                }
              />
              <Label htmlFor="defaultBilling" className="text-sm">
                Default billing
              </Label>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h5 className="font-medium mb-3">Store Contact</h5>
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
              {pending ? "Saving..." : address ? "Update" : "Add address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  products: Props["products"];
  priceLists: Props["priceLists"];
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
      if (result.success) {
        setPricing(result.data);
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
      const result = await upsertCustomerAction({
        id: customerId,
        name: "", // Will be ignored for update
        defaultPriceListId: defaultPriceListId || null,
      });
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
            if (result.success) setPricing(result.data);
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
  products: Props["products"];
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

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function downloadCsv(headers: string[], rows: string[][], filename: string) {
  const csv = [headers, ...rows].map((cols) =>
    cols
      .map((value) => {
        const cell = value ?? "";
        const needsQuotes = /[",\n]/.test(cell);
        const escaped = cell.replace(/"/g, '""');
        return needsQuotes ? `"${escaped}"` : escaped;
      })
      .join(",")
  );
  const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseCsvRow(row: string): string[] {
  return (
    row
      .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      ?.map((value) => value.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? []
  );
}
