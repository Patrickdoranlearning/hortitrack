"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Settings2, Mail, Phone } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { CustomerManagementPayload, CustomerSummary } from "./types";
import { DataPageShell } from "@/components/data-management/DataPageShell";
import { DataToolbar } from "@/components/data-management/DataToolbar";
import {
  upsertCustomerAction,
  deleteCustomerAction,
  assignPriceListToCustomerAction,
  removePriceListAssignmentAction,
} from "./actions";

type Props = CustomerManagementPayload;

export default function CustomerManagementClient({ customers, priceLists }: Props) {
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
        c.store?.toLowerCase().includes(q)
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
      "name",
      "code",
      "email",
      "phone",
      "store",
      "accountsEmail",
      "pricingTier",
      "defaultPriceList",
      "vatNumber",
      "notes",
    ];
    const sample = [
      "Garden Centre HQ",
      "GC-001",
      "orders@gardencentrehq.ie",
      "+3531234567",
      "Woodie's",
      "accounts@gardencentrehq.ie",
      "Tier A",
      priceLists[0]?.name ?? "Wholesale 2025",
      "IE1234567X",
      "Prefers deliveries on Mondays",
    ];
    downloadCsv(headers, [sample], "customers_template.csv");
  };

  const handleDownloadData = () => {
    const headers = [
      "name",
      "code",
      "email",
      "phone",
      "store",
      "accountsEmail",
      "pricingTier",
      "defaultPriceList",
      "vatNumber",
      "notes",
    ];
    const rows = filteredCustomers.map((customer) => [
      customer.name ?? "",
      customer.code ?? "",
      customer.email ?? "",
      customer.phone ?? "",
      customer.store ?? "",
      customer.accountsEmail ?? "",
      customer.pricingTier ?? "",
      customer.defaultPriceListName ?? "",
      customer.vatNumber ?? "",
      customer.notes ?? "",
    ]);
    downloadCsv(headers, rows, "customers.csv");
  };

  const handleUploadCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
    if (!lines.length) {
      throw new Error("The CSV file is empty.");
    }

    const headerLine = lines.shift()!;
    const headers = parseCsvRow(headerLine).map((header) => header.toLowerCase());
    if (!headers.includes("name")) {
      throw new Error('CSV must include a "name" column.');
    }

    let created = 0;
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
      });

      if (result.success) {
        created += 1;
      } else {
        failures.push(name);
      }
    }

    toast({
      title: "Import complete",
      description: `${created} customer${created === 1 ? "" : "s"} imported${
        failures.length ? `, ${failures.length} failed.` : "."
      }`,
      variant: failures.length ? "destructive" : "default",
    });
    router.refresh();
  };

  const filters = (
    <Input
      className="w-full max-w-sm"
      placeholder="Filter by name, code, email…"
      value={filterText}
      onChange={(e) => setFilterText(e.target.value)}
    />
  );

  return (
    <DataPageShell
      title="Customers"
      description="Manage buyer details, pricing assignments, and contact information."
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
            Connected directly to Supabase customers, price lists, and assignments.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No customers found. Use the import tools or click “Add customer”.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Store / Chain</TableHead>
                  <TableHead>Default Price List</TableHead>
                  <TableHead>Price Lists</TableHead>
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
                    <TableCell>{customer.store || "—"}</TableCell>
                    <TableCell>
                      {customer.defaultPriceListName ? (
                        <Badge variant="secondary">{customer.defaultPriceListName}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.priceListAssignments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {customer.priceListAssignments.map((pl) => (
                            <Badge key={pl.id} variant="outline">
                              {pl.priceListName}
                            </Badge>
                          ))}
                        </div>
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
        onSaved={() => {
          router.refresh();
        }}
      />
    </DataPageShell>
  );
}

type CustomerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  customer: CustomerSummary | null;
  priceLists: Props["priceLists"];
  onSaved: () => void;
};

function CustomerSheet({
  open,
  onOpenChange,
  mode,
  customer,
  priceLists,
  onSaved,
}: CustomerSheetProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"details" | "pricing">("details");

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
    };
  }

  const [form, setForm] = useState(() => getInitialForm(customer));

  // Reset form whenever the sheet opens for a different customer
  useEffect(() => {
    if (open) {
      setForm(getInitialForm(customer));
      setActiveTab("details");
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
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed", description: result.error });
        return;
      }
      toast({ title: mode === "create" ? "Customer created" : "Customer updated" });
      onSaved();
      if (mode === "create") {
        onOpenChange(false);
        setForm(getInitialForm(null));
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? `Manage ${customer?.name}` : "Add customer"}</SheetTitle>
          <SheetDescription>
            {mode === "edit"
              ? "Update customer details and pricing assignments."
              : "Create a new customer record."}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="pricing" disabled={mode === "create"}>
              Pricing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Customer name *</Label>
                  <Input
                    placeholder="e.g., Garden Centre HQ"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer code</Label>
                  <Input
                    placeholder="e.g., GC-001"
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sales email</Label>
                  <Input
                    type="email"
                    placeholder="orders@example.com"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Accounts email</Label>
                  <Input
                    type="email"
                    placeholder="accounts@example.com"
                    value={form.accountsEmail}
                    onChange={(e) => setForm((p) => ({ ...p, accountsEmail: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    placeholder="+353 1 234 5678"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  />
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Store / Chain</Label>
                  <Input
                    placeholder="e.g., Woodie's"
                    value={form.store}
                    onChange={(e) => setForm((p) => ({ ...p, store: e.target.value }))}
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

              <div className="space-y-2">
                <Label>Default price list</Label>
                <Select
                  value={form.defaultPriceListId || "__none__"}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, defaultPriceListId: v === "__none__" ? "" : v }))
                  }
                >
                  <SelectTrigger>
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
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  placeholder="Internal notes about this customer..."
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

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
                          This will remove the customer and their data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
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
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4 pt-4">
            {customer && (
              <CustomerPricingSection
                customer={customer}
                priceLists={priceLists}
                onUpdated={() => router.refresh()}
              />
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

type CustomerPricingSectionProps = {
  customer: CustomerSummary;
  priceLists: Props["priceLists"];
  onUpdated: () => void;
};

function CustomerPricingSection({ customer, priceLists, onUpdated }: CustomerPricingSectionProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [newPriceListId, setNewPriceListId] = useState("");

  const assignedIds = new Set(customer.priceListAssignments.map((a) => a.priceListId));
  const availablePriceLists = priceLists.filter((pl) => !assignedIds.has(pl.id));

  const handleAssign = () => {
    if (!newPriceListId) {
      toast({ variant: "destructive", title: "Select a price list" });
      return;
    }
    startTransition(async () => {
      const result = await assignPriceListToCustomerAction({
        customerId: customer.id,
        priceListId: newPriceListId,
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Assignment failed", description: result.error });
        return;
      }
      toast({ title: "Price list assigned" });
      setNewPriceListId("");
      onUpdated();
    });
  };

  const handleRemove = (assignmentId: string) => {
    startTransition(async () => {
      const result = await removePriceListAssignmentAction(assignmentId);
      if (!result.success) {
        toast({ variant: "destructive", title: "Remove failed", description: result.error });
        return;
      }
      toast({ title: "Assignment removed" });
      onUpdated();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold mb-2">Default price list</h4>
        <p className="text-sm text-muted-foreground">
          {customer.defaultPriceListName ?? "No default price list set"}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold">Additional price list assignments</h4>
        {customer.priceListAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No additional price lists assigned.</p>
        ) : (
          <div className="space-y-2">
            {customer.priceListAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{assignment.priceListName}</p>
                  {(assignment.validFrom || assignment.validTo) && (
                    <p className="text-xs text-muted-foreground">
                      {assignment.validFrom && `From: ${assignment.validFrom}`}
                      {assignment.validFrom && assignment.validTo && " • "}
                      {assignment.validTo && `To: ${assignment.validTo}`}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => handleRemove(assignment.id)}
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {availablePriceLists.length > 0 && (
          <div className="flex gap-2">
            <Select value={newPriceListId} onValueChange={setNewPriceListId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select price list to assign" />
              </SelectTrigger>
              <SelectContent>
                {availablePriceLists.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id}>
                    {pl.name} ({pl.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssign} disabled={pending || !newPriceListId}>
              <Plus className="mr-2 h-4 w-4" />
              Assign
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

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

