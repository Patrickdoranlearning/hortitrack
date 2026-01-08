'use client';

import { useMemo, useState } from 'react';
import * as z from 'zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Edit } from 'lucide-react';
import { DataPageShell } from '@/ui/templates';
import { DataToolbar } from '@/ui/templates';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/hooks/use-collection';
import type { Supplier } from '@/lib/types';
import { addSupplierAction, deleteSupplierAction, updateSupplierAction } from '../actions';
import { invalidateReferenceData } from '@/lib/swr/keys';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SupplierForm } from '@/components/supplier-form';
import { PageFrame } from '@/ui/templates';

const supplierTypes = [
  { label: 'Plant supplier', value: 'plant' },
  { label: 'Haulier', value: 'haulier' },
  { label: 'General supplier', value: 'general' },
  { label: 'Hardware supplier', value: 'hardware' },
  { label: 'Administrative supplier', value: 'administrative' },
  { label: 'Stationary supplier', value: 'stationary' },
];

const quickSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  supplierType: z.string().optional(),
  countryCode: z.string().min(2, 'Use ISO country code').max(2, 'Use ISO country code'),
  producerCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

type QuickSupplierFormValues = z.infer<typeof quickSupplierSchema>;

type SortableSupplierKey = 'name' | 'supplierType' | 'countryCode' | 'producerCode' | 'phone' | 'email';

const defaultQuickValues: QuickSupplierFormValues = {
  name: '',
  supplierType: '',
  countryCode: 'IE',
  producerCode: '',
  phone: '',
  email: '',
};

export default function SuppliersPage() {
  const { toast } = useToast();
  const [filterText, setFilterText] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortableSupplierKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  const { data: rawSuppliers, loading } = useCollection<any>('suppliers');
  const suppliers = useMemo<Supplier[]>(() => (rawSuppliers || []).map(normalizeSupplier).filter(Boolean) as Supplier[], [rawSuppliers]);

  const quickForm = useForm<QuickSupplierFormValues>({
    resolver: zodResolver(quickSupplierSchema),
    defaultValues: defaultQuickValues,
  });

  const filteredSuppliers = useMemo(() => {
    if (!filterText) return suppliers;
    const q = filterText.toLowerCase();
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.supplierType, supplier.countryCode, supplier.producerCode]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [suppliers, filterText]);

  const sortedSuppliers = useMemo(() => {
    return [...filteredSuppliers].sort((a, b) => {
      const { key, direction } = sortConfig;
      const left = (a as any)[key] ?? '';
      const right = (b as any)[key] ?? '';
      return direction === 'asc'
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left));
    });
  }, [filteredSuppliers, sortConfig]);

  const handleSort = (key: SortableSupplierKey) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const handleQuickAdd = quickForm.handleSubmit(async (values) => {
    const duplicate = suppliers.find((supplier) => supplier.name.toLowerCase() === values.name.trim().toLowerCase());
    if (duplicate) {
      toast({ variant: 'destructive', title: 'Duplicate name', description: 'This supplier already exists.' });
      return;
    }

    const payload: Omit<Supplier, 'id'> = {
      name: values.name.trim(),
      supplierType: values.supplierType || undefined,
      countryCode: values.countryCode.toUpperCase(),
      producerCode: values.producerCode?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      email: values.email?.trim() || undefined,
      address: undefined,
      eircode: undefined,
    } as any;

    const result = await addSupplierAction(payload);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: 'Supplier added', description: `"${values.name}" is now available.` });
      quickForm.reset(defaultQuickValues);
    } else {
      toast({ variant: 'destructive', title: 'Add failed', description: result.error });
    }
  });

  const handleDownloadTemplate = () => {
    const headers = ['name', 'supplierType', 'countryCode', 'producerCode', 'phone', 'email'];
    const sample = ['Example Nursery', 'plant', 'IE', '12345', '+3531234567', 'hello@example.ie'];
    downloadCsv(headers, [sample], 'suppliers_template.csv');
  };

  const handleDownloadData = () => {
    const headers = ['name', 'supplierType', 'countryCode', 'producerCode', 'phone', 'email', 'address', 'eircode'];
    const rows = sortedSuppliers.map((supplier) => [
      supplier.name ?? '',
      supplier.supplierType ?? '',
      supplier.countryCode ?? '',
      supplier.producerCode ?? '',
      supplier.phone ?? '',
      supplier.email ?? '',
      supplier.address ?? '',
      supplier.eircode ?? '',
    ]);
    downloadCsv(headers, rows, 'suppliers.csv');
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

      const payload: Omit<Supplier, 'id'> = {
        name,
        supplierType: record.supplierType || undefined,
        countryCode: (record.countryCode || 'IE').toUpperCase(),
        producerCode: record.producerCode || undefined,
        phone: record.phone || undefined,
        email: record.email || undefined,
        address: record.address || undefined,
        eircode: record.eircode || undefined,
      } as any;

      const result = await addSupplierAction(payload);
      if (result.success) {
        created += 1;
      } else {
        failures.push(name);
      }
    }

    if (created > 0) {
      invalidateReferenceData();
    }

    toast({
      title: 'Import complete',
      description: `${created} supplier${created === 1 ? '' : 's'} imported. ${failures.length ? `${failures.length} failed.` : ''}`,
      variant: failures.length ? 'destructive' : 'default',
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await deleteSupplierAction(id);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: 'Supplier deleted', description: `"${name}" removed.` });
    } else {
      toast({ variant: 'destructive', title: 'Delete failed', description: result.error });
    }
  };

  const renderSortHeader = (label: string, key: SortableSupplierKey) => {
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
      placeholder="Filter by name, type…"
      value={filterText}
      onChange={(event) => setFilterText(event.target.value)}
    />
  );

  return (
    <PageFrame moduleKey="production">
      <DataPageShell
        title="Suppliers"
        description="Single source for plant, haulage, hardware, and admin suppliers."
        toolbar={
          <DataToolbar
            onDownloadTemplate={handleDownloadTemplate}
            onDownloadData={handleDownloadData}
            onUploadCsv={handleUploadCsv}
            onAddRow={() => {
              const nameField = document.getElementById('quick-supplier-name');
              nameField?.focus();
            }}
            filters={filters}
            extraActions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditingSupplier(null);
                  setIsFormOpen(true);
                }}
              >
                Open form
              </Button>
            }
          />
        }
      >
        <SuppliersTable
          suppliers={sortedSuppliers}
          loading={loading}
          quickForm={quickForm}
          handleQuickAdd={handleQuickAdd}
          renderSortHeader={renderSortHeader}
          setEditingSupplier={setEditingSupplier}
          setIsFormOpen={setIsFormOpen}
          handleDelete={handleDelete}
        />

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <SupplierForm
              supplier={editingSupplier}
              onSubmit={async (values) => {
                const result = await ('id' in values && values.id
                  ? updateSupplierAction(values as Supplier)
                  : addSupplierAction(values as Omit<Supplier, 'id'>));
                if (result.success) {
                  invalidateReferenceData();
                  toast({
                    title: editingSupplier ? 'Supplier updated' : 'Supplier added',
                    description: `"${result.data?.name ?? values.name}" saved successfully.`,
                  });
                  setIsFormOpen(false);
                  setEditingSupplier(null);
                } else {
                  toast({ variant: 'destructive', title: 'Save failed', description: result.error });
                }
              }}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingSupplier(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </DataPageShell>
    </PageFrame>
  );
}

function SuppliersTable({
  suppliers,
  loading,
  quickForm,
  handleQuickAdd,
  renderSortHeader,
  setEditingSupplier,
  setIsFormOpen,
  handleDelete,
}: {
  suppliers: Supplier[];
  loading: boolean;
  quickForm: UseFormReturn<QuickSupplierFormValues>;
  handleQuickAdd: () => void;
  renderSortHeader: (label: string, key: SortableSupplierKey) => React.ReactNode;
  setEditingSupplier: (supplier: Supplier | null) => void;
  setIsFormOpen: (open: boolean) => void;
  handleDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2">
        <h2 className="text-lg font-semibold">Suppliers</h2>
        <p className="text-sm text-muted-foreground">Quick inline entry paired with detailed modal editing.</p>
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
                <TableHead className="px-4 py-2 w-[180px]">{renderSortHeader('Type', 'supplierType')}</TableHead>
                <TableHead className="px-4 py-2 w-[120px]">{renderSortHeader('Country', 'countryCode')}</TableHead>
                <TableHead className="px-4 py-2 w-[160px]">{renderSortHeader('Producer code', 'producerCode')}</TableHead>
                <TableHead className="px-4 py-2 w-[160px]">{renderSortHeader('Phone', 'phone')}</TableHead>
                <TableHead className="px-4 py-2 w-[220px]">{renderSortHeader('Email', 'email')}</TableHead>
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
                            <Input id="quick-supplier-name" placeholder="Supplier name" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <FormField
                      control={quickForm.control}
                      name="supplierType"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Type</FormLabel>
                          <Select value={field.value || 'unspecified'} onValueChange={(val) => field.onChange(val === 'unspecified' ? '' : val)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="unspecified">Unspecified</SelectItem>
                              {supplierTypes.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <FormField
                      control={quickForm.control}
                      name="countryCode"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Country</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="IE"
                              value={field.value ?? ''}
                              maxLength={2}
                              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <FormField
                      control={quickForm.control}
                      name="producerCode"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Producer code</FormLabel>
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
                      name="phone"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Phone" value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value)} />
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
                          <FormLabel className="sr-only">Email</FormLabel>
                          <FormControl>
                            <Input placeholder="Email" type="email" value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value)} />
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

              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="px-4 py-2 font-medium">{supplier.name}</TableCell>
                  <TableCell className="px-4 py-2">{formatSupplierType(supplier.supplierType)}</TableCell>
                  <TableCell className="px-4 py-2">{supplier.countryCode}</TableCell>
                  <TableCell className="px-4 py-2">{supplier.producerCode || '—'}</TableCell>
                  <TableCell className="px-4 py-2">{supplier.phone || '—'}</TableCell>
                  <TableCell className="px-4 py-2">{supplier.email || '—'}</TableCell>
                  <TableCell className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setEditingSupplier(supplier);
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
                            <AlertDialogTitle>Delete "{supplier.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This cannot be undone and the supplier will disappear from dropdowns immediately.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(supplier.id!, supplier.name)}>
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

function normalizeSupplier(row: any): Supplier | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    orgId: row.org_id ?? row.orgId ?? '',
    name: row.name,
    producerCode: row.producer_code ?? row.producerCode ?? undefined,
    countryCode: row.country_code ?? row.countryCode ?? 'IE',
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    eircode: row.eircode ?? undefined,
    supplierType: row.supplier_type ?? row.supplierType ?? undefined,
  } as Supplier;
}

function formatSupplierType(value?: string | null) {
  if (!value) return '—';
  const match = supplierTypes.find((type) => type.value === value);
  return match ? match.label : value;
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
