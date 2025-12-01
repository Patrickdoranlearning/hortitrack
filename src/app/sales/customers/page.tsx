'use client';

import { useMemo, useState } from 'react';
import * as z from 'zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Edit } from 'lucide-react';
import { DataPageShell } from '@/components/data-management/DataPageShell';
import { DataToolbar } from '@/components/data-management/DataToolbar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/hooks/use-collection';
import type { Customer } from '@/lib/types';
import { addCustomerAction, deleteCustomerAction, updateCustomerAction } from '@/app/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CustomerForm } from '@/components/customer-form';
import { PageFrame } from '@/ui/templates/PageFrame';

const quickCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  store: z.string().optional(),
  email: z.string().email().optional(),
  accountsEmail: z.string().email().optional(),
  pricingTier: z.string().optional(),
});

type QuickCustomerValues = z.infer<typeof quickCustomerSchema>;

type SortableCustomerKey = 'name' | 'code' | 'store' | 'pricingTier';

const defaultQuickValues: QuickCustomerValues = {
  name: '',
  code: '',
  store: '',
  email: '',
  accountsEmail: '',
  pricingTier: '',
};

export default function CustomersPage() {
  const { toast } = useToast();
  const [filterText, setFilterText] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortableCustomerKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  const { data: rawCustomers, loading } = useCollection<any>('customers');
  const customers = useMemo<Customer[]>(() => (rawCustomers || []).map(normalizeCustomer).filter(Boolean) as Customer[], [rawCustomers]);

  const quickForm = useForm<QuickCustomerValues>({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues: defaultQuickValues,
  });

  const filteredCustomers = useMemo(() => {
    if (!filterText) return customers;
    const q = filterText.toLowerCase();
    return customers.filter((customer) =>
      [customer.name, customer.code, customer.store, customer.pricingTier]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [customers, filterText]);

  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      const { key, direction } = sortConfig;
      const left = (a as any)[key] ?? '';
      const right = (b as any)[key] ?? '';
      return direction === 'asc'
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left));
    });
  }, [filteredCustomers, sortConfig]);

  const handleSort = (key: SortableCustomerKey) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const handleQuickAdd = quickForm.handleSubmit(async (values) => {
    const duplicate = customers.find((customer) => customer.name.toLowerCase() === values.name.trim().toLowerCase());
    if (duplicate) {
      toast({ variant: 'destructive', title: 'Duplicate name', description: 'That customer already exists.' });
      return;
    }

    const payload: Omit<Customer, 'id'> = {
      name: values.name.trim(),
      code: values.code?.trim() || undefined,
      store: values.store?.trim() || undefined,
      email: values.email?.trim() || undefined,
      accountsEmail: values.accountsEmail?.trim() || undefined,
      pricingTier: values.pricingTier?.trim() || undefined,
      phone: undefined,
      vatNumber: undefined,
      notes: undefined,
      defaultPriceListId: undefined,
    } as any;

    const result = await addCustomerAction(payload);
    if (result.success) {
      toast({ title: 'Customer added', description: `"${values.name}" is now available.` });
      quickForm.reset(defaultQuickValues);
    } else {
      toast({ variant: 'destructive', title: 'Add failed', description: result.error });
    }
  });

  const handleDownloadTemplate = () => {
    const headers = ['name', 'code', 'store', 'email', 'accountsEmail', 'pricingTier'];
    const sample = ['Garden Centre HQ', 'GC-001', 'Garden Centre', 'orders@garden.ie', 'accounts@garden.ie', 'A'];
    downloadCsv(headers, [sample], 'customers_template.csv');
  };

  const handleDownloadData = () => {
    const headers = ['name', 'code', 'store', 'email', 'accountsEmail', 'pricingTier', 'phone', 'vatNumber'];
    const rows = sortedCustomers.map((customer) => [
      customer.name ?? '',
      customer.code ?? '',
      customer.store ?? '',
      customer.email ?? '',
      customer.accountsEmail ?? '',
      customer.pricingTier ?? '',
      customer.phone ?? '',
      customer.vatNumber ?? '',
    ]);
    downloadCsv(headers, rows, 'customers.csv');
  };

  const handleUploadCsv = async (file: File) => {
    const text = await file.text();
    const rows = text.split('\n').filter((row) => row.trim() !== '');
    const headerLine = rows.shift();
    if (!headerLine) throw new Error('The CSV file is empty.');
    const headers = headerLine.split(',').map((h) => h.trim());
    if (!headers.includes('name')) {
      throw new Error('CSV must include a "name" column.');
    }

    let created = 0;
    const failures: string[] = [];

    for (const row of rows) {
      if (!row.trim()) continue;
      const values = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((v) => v.replace(/"/g, '').trim()) ?? [];
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ?? '';
      });

      const name = record.name?.trim();
      if (!name) {
        failures.push('(missing name)');
        continue;
      }

      const payload: Omit<Customer, 'id'> = {
        name,
        code: record.code || undefined,
        store: record.store || undefined,
        email: record.email || undefined,
        accountsEmail: record.accountsEmail || undefined,
        pricingTier: record.pricingTier || undefined,
        phone: record.phone || undefined,
        vatNumber: record.vatNumber || undefined,
        notes: record.notes || undefined,
        defaultPriceListId: record.defaultPriceListId || undefined,
      } as any;

      const result = await addCustomerAction(payload);
      if (result.success) {
        created += 1;
      } else {
        failures.push(name);
      }
    }

    toast({
      title: 'Import complete',
      description: `${created} customer${created === 1 ? '' : 's'} imported. ${failures.length ? `${failures.length} failed.` : ''}`,
      variant: failures.length ? 'destructive' : 'default',
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await deleteCustomerAction(id);
    if (result.success) {
      toast({ title: 'Customer deleted', description: `"${name}" removed.` });
    } else {
      toast({ variant: 'destructive', title: 'Delete failed', description: result.error });
    }
  };

  const renderSortHeader = (label: string, key: SortableCustomerKey) => {
    const active = sortConfig.key === key;
    const indicator = active ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '';
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide"
        onClick={() => handleSort(key)}
      >
        {label}
        <span className="text-muted-foreground">{indicator}</span>
      </button>
    );
  };

  const filters = (
    <Input
      className="w-full max-w-xs"
      placeholder="Filter by name, code, store…"
      value={filterText}
      onChange={(event) => setFilterText(event.target.value)}
    />
  );

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <DataPageShell
        title="Customers"
        description="Manage buyer details, finance contacts, and pricing tiers."
        toolbar={
          <DataToolbar
            onDownloadTemplate={handleDownloadTemplate}
            onDownloadData={handleDownloadData}
            onUploadCsv={handleUploadCsv}
            onAddRow={() => document.getElementById('quick-customer-name')?.focus()}
            filters={filters}
            extraActions={
              <Button size="sm" variant="secondary" onClick={() => { setEditingCustomer(null); setIsFormOpen(true); }}>
                Open form
              </Button>
            }
          />
        }
      >
        <CustomersTable
          customers={sortedCustomers}
          loading={loading}
          quickForm={quickForm}
          handleQuickAdd={handleQuickAdd}
          renderSortHeader={renderSortHeader}
          setEditingCustomer={setEditingCustomer}
          setIsFormOpen={setIsFormOpen}
          handleDelete={handleDelete}
        />

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-3xl">
            <CustomerForm
              customer={editingCustomer}
              onSubmit={async (values) => {
                const result = await ('id' in values && values.id
                  ? updateCustomerAction(values as Customer)
                  : addCustomerAction(values as Omit<Customer, 'id'>));
                if (result.success) {
                  toast({
                    title: editingCustomer ? 'Customer updated' : 'Customer added',
                    description: `"${result.data?.name ?? values.name}" saved successfully.`,
                  });
                  setIsFormOpen(false);
                  setEditingCustomer(null);
                } else {
                  toast({ variant: 'destructive', title: 'Save failed', description: result.error });
                }
              }}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingCustomer(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </DataPageShell>
    </PageFrame>
  );
}

function CustomersTable({
  customers,
  loading,
  quickForm,
  handleQuickAdd,
  renderSortHeader,
  setEditingCustomer,
  setIsFormOpen,
  handleDelete,
}: {
  customers: Customer[];
  loading: boolean;
  quickForm: UseFormReturn<QuickCustomerValues>;
  handleQuickAdd: () => void;
  renderSortHeader: (label: string, key: SortableCustomerKey) => React.ReactNode;
  setEditingCustomer: (customer: Customer | null) => void;
  setIsFormOpen: (open: boolean) => void;
  handleDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2">
        <h2 className="text-lg font-semibold">Customers</h2>
        <p className="text-sm text-muted-foreground">Inline quick add with dialog editing.</p>
      </div>
      <div className="overflow-x-auto px-4 py-3">
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table className="min-w-[1100px] text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-2 w-[220px]">{renderSortHeader('Name', 'name')}</TableHead>
                <TableHead className="px-4 py-2 w-[160px]">{renderSortHeader('Code', 'code')}</TableHead>
                <TableHead className="px-4 py-2 w-[220px]">{renderSortHeader('Store', 'store')}</TableHead>
                <TableHead className="px-4 py-2 w-[160px]">{renderSortHeader('Pricing', 'pricingTier')}</TableHead>
                <TableHead className="px-4 py-2">Sales email</TableHead>
                <TableHead className="px-4 py-2">Accounts email</TableHead>
                <TableHead className="px-4 py-2 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <Form {...quickForm}>
                <TableRow className="bg-muted/60">
                  <TableCell className="px-4 py-2">
                    <FormField
                      control={quickForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Name</FormLabel>
                          <FormControl>
                            <Input id="quick-customer-name" placeholder="Customer name" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <FormField
                      control={quickForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value)} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <FormField
                      control={quickForm.control}
                      name="store"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Store</FormLabel>
                          <FormControl>
                            <Input placeholder="Store / chain" value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value)} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <FormField
                      control={quickForm.control}
                      name="pricingTier"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Pricing tier</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value)} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <FormField
                      control={quickForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Sales email</FormLabel>
                          <FormControl>
                            <Input placeholder="orders@example.com" type="email" value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value)} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <FormField
                      control={quickForm.control}
                      name="accountsEmail"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Accounts email</FormLabel>
                          <FormControl>
                            <Input placeholder="accounts@example.com" type="email" value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value)} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto gap-2"
                      onClick={handleQuickAdd}
                    >
                      <Plus className="h-4 w-4" />
                      Save row
                    </Button>
                  </TableCell>
                </TableRow>
              </Form>

              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="px-4 py-2 font-medium">{customer.name}</TableCell>
                  <TableCell className="px-4 py-2">{customer.code || '—'}</TableCell>
                  <TableCell className="px-4 py-2">{customer.store || '—'}</TableCell>
                  <TableCell className="px-4 py-2">{customer.pricingTier || '—'}</TableCell>
                  <TableCell className="px-4 py-2">{customer.email || '—'}</TableCell>
                  <TableCell className="px-4 py-2">{customer.accountsEmail || '—'}</TableCell>
                  <TableCell className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setEditingCustomer(customer);
                          setIsFormOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" size="sm" variant="destructive" className="gap-2">
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{customer.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This customer will be removed from drop-downs immediately.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(customer.id!, customer.name)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function normalizeCustomer(row: any): Customer | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    orgId: row.org_id ?? row.orgId ?? '',
    code: row.code ?? undefined,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    vatNumber: row.vat_number ?? row.vatNumber ?? undefined,
    notes: row.notes ?? undefined,
    defaultPriceListId: row.default_price_list_id ?? row.defaultPriceListId ?? undefined,
    store: row.store ?? undefined,
    accountsEmail: row.accounts_email ?? row.accountsEmail ?? undefined,
    pricingTier: row.pricing_tier ?? row.pricingTier ?? undefined,
  } as Customer;
}

function downloadCsv(headers: string[], rows: (string | number | undefined)[][], filename: string) {
  const csv = [headers.join(','), ...rows.map((row) => row.map((value) => (value ?? '').toString()).join(','))].join('\n');
  const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  const link = document.createElement('a');
  link.href = uri;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
