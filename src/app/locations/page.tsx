'use client';

import { useEffect, useMemo, useState } from 'react';
import * as z from 'zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Edit } from 'lucide-react';
import { DataPageShell } from '@/ui/templates';
import { DataToolbar } from '@/ui/templates';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/hooks/use-collection';
import type { NurseryLocation, Site } from '@/lib/types';
import { addLocationAction, deleteLocationAction, updateLocationAction, getSitesAction } from '../actions';
import { invalidateReferenceData } from '@/lib/swr/keys';
import { LocationForm } from '@/components/location-form';
import { PageFrame } from '@/ui/templates';

const quickLocationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nurserySite: z.string().min(1, 'Nursery site is required'),
  type: z.string().min(1, 'Type is required'),
  covered: z.boolean().optional(),
  area: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const num = Number(val);
    return Number.isFinite(num) ? num : undefined;
  }, z.number().nonnegative().optional()),
  siteId: z.string().optional(),
});

type QuickLocationFormValues = z.infer<typeof quickLocationSchema>;

type SortableLocationKey = 'name' | 'nurserySite' | 'type' | 'area' | 'covered' | 'siteId';

const defaultQuickValues: QuickLocationFormValues = {
  name: '',
  nurserySite: '',
  type: '',
  covered: false,
  area: undefined,
  siteId: undefined,
};

export default function LocationsPage() {
  const { toast } = useToast();
  const [filterText, setFilterText] = useState('');
  const [editingLocation, setEditingLocation] = useState<NurseryLocation | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortableLocationKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  const { data: rawLocations, loading } = useCollection<any>('nursery_locations');
  const locations = useMemo<NurseryLocation[]>(() => (rawLocations || []).map(normalizeLocation).filter(Boolean) as NurseryLocation[], [rawLocations]);

  // Fetch sites for the site dropdown and display
  useEffect(() => {
    getSitesAction().then((result) => {
      if (result.success) {
        setSites(result.data as Site[]);
      }
    });
  }, []);

  // Create a lookup map for site names
  const siteNameMap = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site) => {
      if (site.id) map.set(site.id, site.name);
    });
    return map;
  }, [sites]);

  const quickForm = useForm<QuickLocationFormValues>({
    resolver: zodResolver(quickLocationSchema),
    defaultValues: defaultQuickValues,
  });

  const filteredLocations = useMemo(() => {
    if (!filterText) return locations;
    const q = filterText.toLowerCase();
    return locations.filter((location) =>
      [location.name, location.nurserySite, location.type, location.siteId]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [locations, filterText]);

  const sortedLocations = useMemo(() => {
    return [...filteredLocations].sort((a, b) => {
      const { key, direction } = sortConfig;
      const left = (a as any)[key];
      const right = (b as any)[key];
      if (left === right) return 0;
      if (left === undefined || left === null) return direction === 'asc' ? -1 : 1;
      if (right === undefined || right === null) return direction === 'asc' ? 1 : -1;
      if (typeof left === 'number' && typeof right === 'number') {
        return direction === 'asc' ? left - right : right - left;
      }
      return direction === 'asc'
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left));
    });
  }, [filteredLocations, sortConfig]);

  const handleSort = (key: SortableLocationKey) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const handleQuickAdd = quickForm.handleSubmit(async (values) => {
    const duplicate = locations.find((loc) => loc.name.toLowerCase() === values.name.trim().toLowerCase());
    if (duplicate) {
      toast({ variant: 'destructive', title: 'Duplicate name', description: 'A location with that name already exists.' });
      return;
    }

    const payload: Omit<NurseryLocation, 'id'> = {
      name: values.name.trim(),
      nurserySite: values.nurserySite.trim(),
      type: values.type.trim(),
      covered: values.covered ?? false,
      area: values.area,
      siteId: values.siteId?.trim() || undefined,
    } as any;

    const result = await addLocationAction(payload);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: 'Location added', description: `"${values.name}" is now available.` });
      quickForm.reset(defaultQuickValues);
    } else {
      toast({ variant: 'destructive', title: 'Add failed', description: result.error });
    }
  });

  const handleDownloadTemplate = () => {
    const headers = ['name', 'nurserySite', 'type', 'covered', 'area', 'siteId'];
    const sample = ['Tunnel 12', 'Main', 'Tunnel', 'true', '450', 'main-t12'];
    downloadCsv(headers, [sample], 'nursery_locations_template.csv');
  };

  const handleDownloadData = () => {
    const headers = ['name', 'nurserySite', 'type', 'covered', 'area', 'siteId'];
    const rows = sortedLocations.map((loc) => [
      loc.name ?? '',
      loc.nurserySite ?? '',
      loc.type ?? '',
      String(Boolean(loc.covered)),
      loc.area ?? '',
      loc.siteId ?? '',
    ]);
    downloadCsv(headers, rows, 'nursery_locations.csv');
  };

  const handleUploadCsv = async (file: File) => {
    const text = await file.text();
    const rows = text.split('\n').filter((row) => row.trim() !== '');
    const headerLine = rows.shift();
    if (!headerLine) throw new Error('The CSV file is empty.');
    const headers = headerLine.split(',').map((h) => h.trim());
    const required = ['name', 'nurserySite', 'type'];
    if (!required.every((h) => headers.includes(h))) {
      throw new Error(`CSV headers are missing or incorrect. Required: ${required.join(', ')}`);
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

      const payload: Omit<NurseryLocation, 'id'> = {
        name,
        nurserySite: record.nurserySite?.trim() || 'Main',
        type: record.type?.trim() || 'Tunnel',
        covered: ['true', '1', 'yes'].includes(record.covered?.toLowerCase()),
        area: record.area ? Number(record.area) : undefined,
        siteId: record.siteId?.trim() || undefined,
      } as any;

      const result = await addLocationAction(payload);
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
      description: `${created} location${created === 1 ? '' : 's'} imported. ${failures.length ? `${failures.length} failed.` : ''}`,
      variant: failures.length ? 'destructive' : 'default',
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await deleteLocationAction(id);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: 'Location deleted', description: `"${name}" removed.` });
    } else {
      toast({ variant: 'destructive', title: 'Delete failed', description: result.error });
    }
  };

  const renderSortHeader = (label: string, key: SortableLocationKey) => {
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
      placeholder="Filter by name, site, type…"
      value={filterText}
      onChange={(event) => setFilterText(event.target.value)}
    />
  );

  return (
    <PageFrame moduleKey="production">
      <DataPageShell
        title="Nursery Locations"
        description="Keep tunnels, glasshouses, and sections aligned across propagation forms."
        toolbar={
          <DataToolbar
            onDownloadTemplate={handleDownloadTemplate}
            onDownloadData={handleDownloadData}
            onUploadCsv={handleUploadCsv}
            onAddRow={() => {
              const nameField = document.getElementById('quick-location-name');
              nameField?.focus();
            }}
            filters={filters}
            extraActions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditingLocation(null);
                  setIsFormOpen(true);
                }}
              >
                Open form
              </Button>
            }
          />
        }
      >
        <CardWithTable
          locations={sortedLocations}
          loading={loading}
          quickForm={quickForm}
          handleQuickAdd={handleQuickAdd}
          renderSortHeader={renderSortHeader}
          setEditingLocation={setEditingLocation}
          setIsFormOpen={setIsFormOpen}
          handleDelete={handleDelete}
          sites={sites}
          siteNameMap={siteNameMap}
        />

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <LocationForm
              location={editingLocation}
              sites={sites}
              onSubmit={async (values) => {
                const result = await (values as any).id
                  ? updateLocationAction(values as NurseryLocation)
                  : addLocationAction(values as Omit<NurseryLocation, 'id'>);
                if (result.success) {
                  invalidateReferenceData();
                  toast({
                    title: (values as any).id ? 'Location updated' : 'Location added',
                    description: `"${result.data?.name ?? values.name}" saved successfully.`,
                  });
                  setIsFormOpen(false);
                  setEditingLocation(null);
                } else {
                  toast({ variant: 'destructive', title: 'Save failed', description: result.error });
                }
              }}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingLocation(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </DataPageShell>
    </PageFrame>
  );
}

function CardWithTable({
  locations,
  loading,
  quickForm,
  handleQuickAdd,
  renderSortHeader,
  setEditingLocation,
  setIsFormOpen,
  handleDelete,
  sites,
  siteNameMap,
}: {
  locations: NurseryLocation[];
  loading: boolean;
  quickForm: UseFormReturn<QuickLocationFormValues>;
  handleQuickAdd: () => void;
  renderSortHeader: (label: string, key: SortableLocationKey) => React.ReactNode;
  setEditingLocation: (loc: NurseryLocation | null) => void;
  setIsFormOpen: (open: boolean) => void;
  handleDelete: (id: string, name: string) => void;
  sites: Site[];
  siteNameMap: Map<string, string>;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2">
        <h2 className="text-lg font-semibold">Locations</h2>
        <p className="text-sm text-muted-foreground">Inline add, edit, and remove nursery locations.</p>
      </div>
      <div className="overflow-x-auto px-4 py-3">
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table className="min-w-[700px] text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-2 w-[220px]">{renderSortHeader('Name', 'name')}</TableHead>
                <TableHead className="px-4 py-2 w-[200px] hidden md:table-cell">{renderSortHeader('Nursery site', 'nurserySite')}</TableHead>
                <TableHead className="px-4 py-2 w-[160px]">{renderSortHeader('Type', 'type')}</TableHead>
                <TableHead className="px-4 py-2 w-[140px] hidden md:table-cell">{renderSortHeader('Covered', 'covered')}</TableHead>
                <TableHead className="px-4 py-2 w-[140px] hidden lg:table-cell">{renderSortHeader('Area (m²)', 'area')}</TableHead>
                <TableHead className="px-4 py-2 w-[200px] hidden lg:table-cell">{renderSortHeader('Site', 'siteId')}</TableHead>
                <TableHead className="text-right px-4 py-2">Actions</TableHead>
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
                            <Input id="quick-location-name" placeholder="Add new location…" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2 hidden md:table-cell">
                    <FormField
                      control={quickForm.control}
                      name="nurserySite"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Nursery site</FormLabel>
                          <FormControl>
                            <Input placeholder="Main / Alberts…" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <FormField
                      control={quickForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Type</FormLabel>
                          <FormControl>
                            <Input placeholder="Tunnel, Glasshouse…" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2 hidden md:table-cell">
                    <FormField
                      control={quickForm.control}
                      name="covered"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Covered</FormLabel>
                          <Select
                            value={field.value ? 'covered' : 'uncovered'}
                            onValueChange={(value) => field.onChange(value === 'covered')}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Covered?" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="covered">Covered</SelectItem>
                              <SelectItem value="uncovered">Uncovered</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2 hidden lg:table-cell">
                    <FormField
                      control={quickForm.control}
                      name="area"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Area</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="m²"
                              value={field.value ?? ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                field.onChange(value === '' ? undefined : Number(value));
                              }}
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2 hidden lg:table-cell">
                    <FormField
                      control={quickForm.control}
                      name="siteId"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">Site</FormLabel>
                          <Select
                            value={field.value ?? ''}
                            onValueChange={(value) => field.onChange(value || undefined)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select site..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {sites.map((site) => (
                                <SelectItem key={site.id} value={site.id!}>
                                  {site.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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

              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="px-4 py-2 font-medium">{location.name}</TableCell>
                  <TableCell className="px-4 py-2 hidden md:table-cell">{location.nurserySite || '—'}</TableCell>
                  <TableCell className="px-4 py-2">{location.type || '—'}</TableCell>
                  <TableCell className="px-4 py-2 hidden md:table-cell">{location.covered ? 'Covered' : 'Uncovered'}</TableCell>
                  <TableCell className="px-4 py-2 hidden lg:table-cell">{location.area ? `${location.area.toLocaleString()} m²` : '—'}</TableCell>
                  <TableCell className="px-4 py-2 hidden lg:table-cell">{location.siteId ? siteNameMap.get(location.siteId) || location.siteId : '—'}</TableCell>
                  <TableCell className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setEditingLocation(location);
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
                            <AlertDialogTitle>Delete "{location.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This cannot be undone and existing batches will lose this reference.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(location.id!, location.name)}>
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

function normalizeLocation(row: any): NurseryLocation | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    nurserySite: row.nursery_site ?? row.nurserySite ?? 'Main',
    type: row.type ?? undefined,
    covered: row.covered ?? false,
    area: typeof row.area === 'number' ? row.area : row.area ? Number(row.area) : undefined,
    siteId: row.site_id ?? row.siteId ?? undefined,
    orgId: row.org_id ?? row.orgId ?? '',
    healthStatus: row.health_status ?? row.healthStatus ?? 'clean',
    restrictedUntil: row.restricted_until ?? row.restrictedUntil ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  } as NurseryLocation;
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
