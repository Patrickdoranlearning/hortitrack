"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { emitMutation } from "@/lib/events/mutation-events";
import {
  Plus,
  Settings2,
  Mail,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type {
  CustomerManagementPayload,
  CustomerSummary,
} from "./types";
import { COUNTRY_OPTIONS } from "./types";
import { DataPageShell } from '@/ui/templates';
import { DataToolbar } from '@/ui/templates';
import {
  upsertCustomerAction,
  upsertCustomerAddressAction,
  upsertCustomerContactAction,
} from "./actions";
import { CustomerSheet } from "./CustomerSheet";

type Props = CustomerManagementPayload;

export default function CustomerManagementClient({ customers, priceLists, products }: Props) {
  const { toast } = useToast();
  const router = useRouter();
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
    emitMutation({ resource: 'customers', action: 'update' });
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
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No customers found. Use the import tools or click "Add customer".</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Code</TableHead>
                    <TableHead className="hidden lg:table-cell">Contact</TableHead>
                    <TableHead className="hidden sm:table-cell">Country</TableHead>
                    <TableHead className="hidden xl:table-cell">Currency</TableHead>
                    <TableHead className="hidden lg:table-cell">Addresses</TableHead>
                    <TableHead className="text-right w-[80px] sm:w-auto">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/sales/customers/${customer.id}`)}
                  >
                    <TableCell className="font-medium">
                      {customer.name}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{customer.code || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-col gap-1 text-sm">
                        {customer.email && (
                          <a
                            className="flex items-center gap-1 text-muted-foreground hover:underline"
                            href={`mailto:${customer.email}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{customer.email}</span>
                          </a>
                        )}
                        {customer.phone && (
                          <a
                            className="flex items-center gap-1 text-muted-foreground hover:underline"
                            href={`tel:${customer.phone}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </a>
                        )}
                        {!customer.email && !customer.phone && "—"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline">
                        {COUNTRY_OPTIONS.find((c) => c.code === customer.countryCode)?.name ?? customer.countryCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">{customer.currency}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {customer.addresses.length > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {customer.addresses.length} location{customer.addresses.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(customer);
                        }}
                      >
                        <Settings2 className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Manage</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
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
          emitMutation({ resource: 'customers', action: 'update' });
        }}
      />
    </DataPageShell>
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
