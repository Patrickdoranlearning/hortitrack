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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/hooks/use-collection';
import type { Haulier } from '@/lib/types';
import { addHaulierAction, deleteHaulierAction, updateHaulierAction } from '@/app/actions';
import { invalidateReferenceData } from '@/lib/swr/keys';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { HaulierForm } from '@/components/haulier-form';
import { PageFrame } from '@/ui/templates';

const quickHaulierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

type QuickHaulierValues = z.infer<typeof quickHaulierSchema>;

type SortableHaulierKey = 'name' | 'phone' | 'email';

const defaultQuickValues: QuickHaulierValues = {
  name: '',
  phone: '',
  email: '',
};

export default function HauliersPage() {
  const { toast } = useToast();
  const [filterText, setFilterText] = useState('');
  const [editingHaulier, setEditingHaulier] = useState<Haulier | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortableHaulierKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  const { data: rawHauliers, loading } = useCollection<any>('hauliers');
  const hauliers = useMemo<Haulier[]>(() => (rawHauliers || []).map(normalizeHaulier).filter(Boolean) as Haulier[], [rawHauliers]);

  const quickForm = useForm<QuickHaulierValues>({
    resolver: zodResolver(quickHaulierSchema),
    defaultValues: defaultQuickValues,
  });

  const filteredHauliers = useMemo(() => {
    if (!filterText) return hauliers;
    const q = filterText.toLowerCase();
    return hauliers.filter((haulier) =>
      [haulier.name, haulier.phone, haulier.email]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [hauliers, filterText]);

  const sortedHauliers = useMemo(() => {
    return [...filteredHauliers].sort((a, b) => {
      const { key, direction } = sortConfig;
      const left = (a as any)[key] ?? '';
      const right = (b as any)[key] ?? '';
      return direction === 'asc'
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left));
    });
  }, [filteredHauliers, sortConfig]);

  const handleSort = (key: SortableHaulierKey) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const handleQuickAdd = quickForm.handleSubmit(async (values) => {
    const duplicate = hauliers.find((haulier) => haulier.name.toLowerCase() === values.name.trim().toLowerCase());
    if (duplicate) {
      toast({ variant: 'destructive', title: 'Duplicate name', description: 'That haulier already exists.' });
      return;
    }

    const payload: Omit<Haulier, 'id'> = {
      name: values.name.trim(),
      phone: values.phone?.trim() || undefined,
      email: values.email?.trim() || undefined,
      notes: undefined,
      isActive: true,
    } as any;

    const result = await addHaulierAction(payload);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: 'Haulier added', description: `"${values.name}" is now available.` });
      quickForm.reset(defaultQuickValues);
    } else {
      toast({ variant: 'destructive', title: 'Add failed', description: result.error });
    }
  });

  const handleDownloadTemplate = () => {
    const headers = ['name', 'phone', 'email'];
    const sample = ['Logistics Ltd', '+3531234567', 'dispatch@logistics.ie'];
    downloadCsv(headers, [sample], 'hauliers_template.csv');
  };

  const handleDownloadData = () => {
    const headers = ['name', 'phone', 'email', 'notes', 'isActive'];
    const rows = sortedHauliers.map((haulier) => [
      haulier.name,
      haulier.phone ?? '',
      haulier.email ?? '',
      haulier.notes ?? '',
      String(haulier.isActive ?? true),
    ]);
    downloadCsv(headers, rows, 'hauliers.csv');
  };

  const handleUploadCsv = async (file: File) => {
    const text = await file.text();
    const rows = text.split('\n').filter((row) => row.trim() !== '');
    const headerLine = rows.shift();
    if (!headerLine) throw new Error('The CSV file is empty.');
    const headers = headerLine.split(',').map((h) => h.trim());
    if (!headers.includes('name')) throw new Error('CSV must include a "name" column.');

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

      const payload: Omit<Haulier, 'id'> = {
        name,
        phone: record.phone || undefined,
        email: record.email || undefined,
        notes: record.notes || undefined,
        isActive: record.isActive ? ['true', '1', 'yes'].includes(record.isActive.toLowerCase()) : true,
      } as any;

      const result = await addHaulierAction(payload);
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
      description: `${created} haulier${created === 1 ? '' : 's'} imported. ${failures.length ? `${failures.length} failed.` : ''}`,
      variant: failures.length ? 'destructive' : 'default',
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await deleteHaulierAction(id);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: 'Haulier deleted', description: `"${name}" removed.` });
    } else {
      toast({ variant: 'destructive', title: 'Delete failed', description: result.error });
    }
  };

  const renderSortHeader = (label: string, key: SortableHaulierKey) => {
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
      placeholder="Filter by name, contact…"
      value={filterText}
      onChange={(event) => setFilterText(event.target.value)}
    />
  );

  return (
    <PageFrame moduleKey="production">
      <DataPageShell
        title="Hauliers"
        description="Maintain approved logistics partners for dispatch screens."
        toolbar={
          <DataToolbar
            onDownloadTemplate={handleDownloadTemplate}
            onDownloadData={handleDownloadData}
            onUploadCsv={handleUploadCsv}
            onAddRow={() => document.getElementById('quick-haulier-name')?.focus()}
            filters={filters}
            extraActions={
              <Button size="sm" variant="secondary" onClick={() => { setEditingHaulier(null); setIsFormOpen(true); }}>
                Open form
              </Button>
            }
          />
        }
      >
        <HauliersTable
          hauliers={sortedHauliers}
          loading={loading}
          quickForm={quickForm}
          handleQuickAdd={handleQuickAdd}
          renderSortHeader={renderSortHeader}
          setEditingHaulier={setEditingHaulier}
          setIsFormOpen={setIsFormOpen}
          handleDelete={handleDelete}
        />

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <HaulierForm
              haulier={editingHaulier}
              onSubmit={async (values) => {
                const result = await ('id' in values && values.id
                  ? updateHaulierAction(values as Haulier)
                  : addHaulierAction(values as Omit<Haulier, 'id'>));
                if (result.success) {
                  invalidateReferenceData();
                  toast({
                    title: editingHaulier ? 'Haulier updated' : 'Haulier added',
                    description: `"${result.data?.name ?? values.name}" saved successfully.`,
                  });
                  setIsFormOpen(false);
                  setEditingHaulier(null);
                } else {
                  toast({ variant: 'destructive', title: 'Save failed', description: result.error });
                }
              }}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingHaulier(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </DataPageShell>
    </PageFrame>
  );
}

function HauliersTable({
  hauliers,
  loading,
  quickForm,
  handleQuickAdd,
  renderSortHeader,
  setEditingHaulier,
  setIsFormOpen,
  handleDelete,
}: {
  hauliers: Haulier[];
  loading: boolean;
  quickForm: UseFormReturn<QuickHaulierValues>;
  handleQuickAdd: () => void;
  renderSortHeader: (label: string, key: SortableHaulierKey) => React.ReactNode;
  setEditingHaulier: (haulier: Haulier | null) => void;
  setIsFormOpen: (open: boolean) => void;
  handleDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2">
        <h2 className="text-lg font-semibold">Hauliers</h2>
        <p className="text-sm text-muted-foreground">Track approved carriers and their contact info.</p>
      </div>
      <div className="overflow-x-auto px-4 py-3">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table className="min-w-[900px] text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-2 w-[260px]">{renderSortHeader('Name', 'name')}</TableHead>
                <TableHead className="px-4 py-2 w-[200px]">{renderSortHeader('Phone', 'phone')}</TableHead>
                <TableHead className="px-4 py-2 w-[240px]">{renderSortHeader('Email', 'email')}</TableHead>
                <TableHead className="px-4 py-2 w-[140px]">Status</TableHead>
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
                            <Input id="quick-haulier-name" placeholder="Haulier name" {...field} />
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
                  <TableCell className="px-4 py-2">Active</TableCell>
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

              {hauliers.map((haulier) => (
                <TableRow key={haulier.id}>
                  <TableCell className="px-4 py-2 font-medium">{haulier.name}</TableCell>
                  <TableCell className="px-4 py-2">{haulier.phone || '—'}</TableCell>
                  <TableCell className="px-4 py-2">{haulier.email || '—'}</TableCell>
                  <TableCell className="px-4 py-2">{haulier.isActive ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setEditingHaulier(haulier);
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
                            <AlertDialogTitle>Delete "{haulier.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This carrier will be removed from selection lists.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(haulier.id!, haulier.name)}>
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

function normalizeHaulier(row: any): Haulier | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    orgId: row.org_id ?? row.orgId ?? '',
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    notes: row.notes ?? undefined,
    isActive: row.is_active ?? row.isActive ?? true,
  } as Haulier;
}

function downloadCsv(headers: string[], rows: (string | number | boolean | undefined)[][], filename: string) {
  const csv = [headers.join(','), ...rows.map((row) => row.map((value) => (value ?? '').toString()).join(','))].join('\n');
  const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  const link = document.createElement('a');
  link.href = uri;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
