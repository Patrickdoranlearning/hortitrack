'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { INITIAL_PLANT_SIZES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import type { PlantSize } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { SizeForm } from '@/components/size-form';
import { useAuth } from '@/hooks/use-auth';
import { addSizeAction, deleteSizeAction, updateSizeAction } from '../actions';
import { invalidateReferenceData } from '@/lib/swr/keys';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection } from '@/hooks/use-collection';
import { PageFrame } from '@/ui/templates';
import { DataPageShell } from '@/ui/templates';
import { DataToolbar } from '@/ui/templates';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit } from 'lucide-react';
import { useAttributeOptions } from '@/hooks/useAttributeOptions';

const quickSizeSchema = z.object({
  name: z.string().min(1, 'Size name is required'),
  containerType: z.string().min(1, 'Container type is required'),
  cellMultiple: z.coerce.number().int().min(1).default(1),
  trayQuantity: z.coerce.number().int().min(0).optional(),
  shelfQuantity: z.coerce.number().int().min(0).default(0),
  trolleyQuantity: z.coerce.number().int().min(0).optional(),
  area: z.coerce.number().min(0).optional(),
  cellVolumeL: z.coerce.number().min(0).optional(),
  cellWidthMm: z.coerce.number().min(0).optional(),
  cellLengthMm: z.coerce.number().min(0).optional(),
  cellShape: z.enum(['round', 'square']).optional(),
});

type QuickSizeFormValues = z.infer<typeof quickSizeSchema>;

const defaultQuickValues: QuickSizeFormValues = {
  name: '',
  containerType: 'pot',
  cellMultiple: 1,
  trayQuantity: undefined,
  shelfQuantity: 0,
  trolleyQuantity: undefined,
  area: undefined,
  cellVolumeL: undefined,
  cellWidthMm: undefined,
  cellLengthMm: undefined,
  cellShape: undefined,
};

type SortableSizeKey =
  | 'name'
  | 'containerType'
  | 'cellMultiple'
  | 'trayQuantity'
  | 'shelfQuantity'
  | 'trolleyQuantity'
  | 'area'
  | 'cellVolumeL'
  | 'cellWidthMm'
  | 'cellLengthMm'
  | 'cellShape';

export default function SizesPage() {
  const { loading: authLoading } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<PlantSize | null>(null);
  const { toast } = useToast();
  const nameFieldRef = useRef<HTMLInputElement | null>(null);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableSizeKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  // Fetch container types from dropdown manager (configurable per tenant)
  const { options: containerTypeOptions, isLoading: containerTypesLoading } = useAttributeOptions('size_container_type');

  const { data: sizesData, loading: sizesLoading } = useCollection<any>('plant_sizes', INITIAL_PLANT_SIZES);
  const sizes = useMemo<PlantSize[]>(() => {
    return (sizesData || []).map(normalizeSizeRow);
  }, [sizesData]);
  const isLoading = authLoading || sizesLoading || containerTypesLoading;

  const quickForm = useForm<QuickSizeFormValues>({
    resolver: zodResolver(quickSizeSchema),
    defaultValues: defaultQuickValues,
  });

  // Watch dimensions to auto-calculate area
  const watchedWidth = quickForm.watch('cellWidthMm');
  const watchedLength = quickForm.watch('cellLengthMm');

  useEffect(() => {
    if (!watchedWidth || !watchedLength || Number.isNaN(watchedWidth) || Number.isNaN(watchedLength)) {
      return;
    }
    const derivedArea = Number(((watchedWidth * watchedLength) / 1_000_000).toFixed(4));
    if (derivedArea !== quickForm.getValues('area')) {
      quickForm.setValue('area', derivedArea);
    }
  }, [watchedWidth, watchedLength, quickForm]);

  const filteredSizes = useMemo(() => {
    if (!filterText) return sizes;
    const query = filterText.toLowerCase();
    return sizes.filter(
      (size) =>
        size.name?.toLowerCase().includes(query) ||
        size.containerType?.toLowerCase().includes(query)
    );
  }, [sizes, filterText]);

  const sortedSizes = useMemo(() => {
    return [...filteredSizes].sort((a, b) => {
      const { key, direction } = sortConfig;
      const left = a?.[key];
      const right = b?.[key];

      if (left === undefined || left === null) return direction === 'asc' ? 1 : -1;
      if (right === undefined || right === null) return direction === 'asc' ? -1 : 1;

      if (typeof left === 'number' && typeof right === 'number') {
        return direction === 'asc' ? left - right : right - left;
      }

      const leftStr = String(left).toLowerCase();
      const rightStr = String(right).toLowerCase();
      if (leftStr < rightStr) return direction === 'asc' ? -1 : 1;
      if (leftStr > rightStr) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSizes, sortConfig]);

  const handleSort = (key: SortableSizeKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const renderHeaderButton = (label: string, key: SortableSizeKey) => {
    const isActive = sortConfig.key === key;
    const indicator = isActive ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '';
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

  const handleAddSize = () => {
    setEditingSize(null);
    setIsFormOpen(true);
  };

  const handleEditSize = (size: PlantSize) => {
    setEditingSize(size);
    setIsFormOpen(true);
  };

  const handleDeleteSize = async (sizeId: string) => {
    const sizeToDelete = sizes.find((s) => s.id === sizeId);
    if (!sizeToDelete) return;
    const result = await deleteSizeAction(sizeId);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: 'Size deleted', description: `Removed "${sizeToDelete.name}".` });
    } else {
      toast({ variant: 'destructive', title: 'Delete failed', description: result.error });
    }
  };

  const handleFormSubmit = async (data: Omit<PlantSize, 'id'> | PlantSize) => {
    const isEditing = 'id' in data;
    const result = isEditing
      ? await updateSizeAction(data as PlantSize)
      : await addSizeAction(data as Omit<PlantSize, 'id'>);

    if (result.success) {
      invalidateReferenceData();
      toast({
        title: isEditing ? 'Size updated' : 'Size added',
        description: `Successfully ${isEditing ? 'updated' : 'added'} "${result.data?.name}".`,
      });
      setIsFormOpen(false);
      setEditingSize(null);
    } else {
      toast({
        variant: 'destructive',
        title: isEditing ? 'Update failed' : 'Add failed',
        description: result.error,
      });
    }
  };

  const handleQuickAdd = quickForm.handleSubmit(async (values) => {
    const normalizedName = values.name.trim().toLowerCase();
    if (
      sizes.some(
        (size) => size.name && size.name.trim().toLowerCase() === normalizedName
      )
    ) {
      toast({
        variant: 'destructive',
        title: 'Duplicate size',
        description: `"${values.name}" already exists. Edit the existing row instead.`,
      });
      return;
    }

    const payload: Omit<PlantSize, 'id'> = {
      name: values.name.trim(),
      containerType: values.containerType,
      cellMultiple: values.cellMultiple ?? 1,
      trayQuantity: values.trayQuantity,
      shelfQuantity: values.shelfQuantity ?? 0,
      trolleyQuantity: values.trolleyQuantity,
      area: values.area,
      cellVolumeL: values.cellVolumeL,
      cellWidthMm: values.cellWidthMm,
      cellLengthMm: values.cellLengthMm,
      cellShape: values.cellShape,
    };

    const result = await addSizeAction(payload);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: 'Size added', description: `"${values.name}" is now available.` });
      quickForm.reset(defaultQuickValues);
      nameFieldRef.current?.focus();
    } else {
      toast({ variant: 'destructive', title: 'Add failed', description: result.error });
    }
  });

  const handleDownloadTemplate = async () => {
    const headers = [
      'name',
      'containerType',
      'cellMultiple',
      'trayQuantity',
      'shelfQuantity',
      'trolleyQuantity',
      'area',
      'cellVolumeL',
      'cellWidthMm',
      'cellLengthMm',
      'cellShape',
    ];
    const sampleRow = [
      'P9',
      'pot',
      '1',
      '54',
      '80',
      '480',
      '0.01',
      '',
      '',
      '',
      'round',
    ].join(',');
    downloadCsv(headers, [sampleRow], 'plant_sizes_template.csv');
  };

  const handleDownloadData = async () => {
    const headers = [
      'name',
      'containerType',
      'cellMultiple',
      'trayQuantity',
      'shelfQuantity',
      'trolleyQuantity',
      'area',
      'cellVolumeL',
      'cellWidthMm',
      'cellLengthMm',
      'cellShape',
    ];
    const rows = sortedSizes.map((size) =>
      headers.map((header) => `"${(size as any)[header] ?? ''}"`).join(',')
    );
    downloadCsv(headers, rows, 'plant_sizes.csv');
  };

  const handleUploadCsv = async (file: File) => {
    const text = await file.text();
    const rows = text.split('\n').filter((row) => row.trim() !== '');
    const headerLine = rows.shift();
    if (!headerLine) throw new Error('The CSV file is empty.');

    const headers = headerLine.split(',').map((h) => h.trim().replace(/"/g, ''));
    const required = ['name', 'containerType'];
    if (!required.every((h) => headers.includes(h))) {
      throw new Error(`CSV headers are missing or incorrect. Required: ${required.join(', ')}`);
    }

    const existingNames = new Set(
      sizes
        .map((size) => size.name?.trim().toLowerCase())
        .filter((name): name is string => Boolean(name))
    );

    let created = 0;
    const duplicates: string[] = [];
    const failures: string[] = [];

    for (const row of rows) {
      if (!row.trim()) continue;
      const values =
        row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((v) => v.replace(/"/g, '').trim()) ?? [];
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ?? '';
      });
      const normalizedName = record.name?.trim().toLowerCase();
      if (!record.name || !normalizedName) {
        failures.push('(missing name)');
        continue;
      }

      if (existingNames.has(normalizedName)) {
        duplicates.push(record.name);
        continue;
      }

      const payload: Omit<PlantSize, 'id'> = {
        name: record.name.trim(),
        containerType: (record.containerType || 'pot').toLowerCase() as PlantSize['containerType'],
        cellMultiple: record.cellMultiple ? Number(record.cellMultiple) : 1,
        trayQuantity: record.trayQuantity ? Number(record.trayQuantity) : undefined,
        shelfQuantity: record.shelfQuantity ? Number(record.shelfQuantity) : 0,
        trolleyQuantity: record.trolleyQuantity ? Number(record.trolleyQuantity) : undefined,
        area: record.area ? Number(record.area) : undefined,
        cellVolumeL: record.cellVolumeL ? Number(record.cellVolumeL) : undefined,
        cellWidthMm: record.cellWidthMm ? Number(record.cellWidthMm) : undefined,
        cellLengthMm: record.cellLengthMm ? Number(record.cellLengthMm) : undefined,
        cellShape: record.cellShape ? (record.cellShape.toLowerCase() as 'round' | 'square') : undefined,
      };

      const result = await addSizeAction(payload);
      if (result.success) {
        created += 1;
        existingNames.add(normalizedName);
      } else {
        failures.push(record.name);
      }
    }

    if (created > 0) {
      invalidateReferenceData();
    }

    let description = `${created} new size${created === 1 ? '' : 's'} added.`;
    if (duplicates.length) {
      description += ` Skipped ${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'} (${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? ', …' : ''}).`;
    }
    if (failures.length) {
      description += ` Failed to import ${failures.length} row${failures.length === 1 ? '' : 's'}.`;
    }

    toast({
      title: 'Import complete',
      description,
      variant: failures.length ? 'destructive' : 'default',
    });
  };

  const focusQuickRow = () => nameFieldRef.current?.focus();

  return (
    <PageFrame moduleKey="production">
      <DataPageShell
        title="Plant Sizes"
        description="Standardise tray, pot, and bareroot data for propagation, transplanting, and sales."
        toolbar={
          <DataToolbar
            onDownloadTemplate={handleDownloadTemplate}
            onDownloadData={handleDownloadData}
            onUploadCsv={handleUploadCsv}
            onAddRow={focusQuickRow}
            filters={
              <Input
                className="w-full max-w-xs"
                placeholder="Filter by size or type…"
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
              />
            }
            extraActions={
              <Button size="sm" onClick={handleAddSize}>
                <Plus className="mr-2 h-4 w-4" />
                Manage form
              </Button>
            }
          />
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Golden table</CardTitle>
            <CardDescription>Use the quick row for single entries or the pencil icon to edit existing sizes.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table className="min-w-[1300px] text-sm whitespace-nowrap">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-2 min-w-[160px]">{renderHeaderButton('Size / Label', 'name')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[100px]">{renderHeaderButton('Type', 'containerType')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[80px]">{renderHeaderButton('Cells', 'cellMultiple')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[90px]">{renderHeaderButton('Tray qty', 'trayQuantity')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[90px]">{renderHeaderButton('Shelf qty', 'shelfQuantity')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[100px]">{renderHeaderButton('Trolley qty', 'trolleyQuantity')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[100px]">{renderHeaderButton('Volume (L)', 'cellVolumeL')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[150px]">{renderHeaderButton('Dimensions (mm)', 'cellWidthMm')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[90px]">{renderHeaderButton('Shape', 'cellShape')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[100px]">{renderHeaderButton('Area (m²)', 'area')}</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <Form {...quickForm}>
                    <TableRow className="bg-muted/70">
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Size / Label</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Add new size…"
                                  {...field}
                                  ref={(node) => {
                                    nameFieldRef.current = node;
                                    field.ref(node);
                                  }}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="containerType"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {containerTypeOptions.map((opt) => (
                                    <SelectItem key={opt.systemCode} value={opt.systemCode}>
                                      {opt.displayLabel}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="cellMultiple"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Cells</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  placeholder="e.g., 54"
                                  value={field.value ?? ''}
                                  onChange={(event) =>
                                    field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="trayQuantity"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Tray qty</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="e.g., 54"
                                  value={field.value ?? ''}
                                  onChange={(event) =>
                                    field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="shelfQuantity"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Shelf qty</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="e.g., 80"
                                  value={field.value ?? ''}
                                  onChange={(event) =>
                                    field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="trolleyQuantity"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Trolley qty</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="e.g., 480"
                                  value={field.value ?? ''}
                                  onChange={(event) =>
                                    field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="cellVolumeL"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Volume</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Optional"
                                  value={field.value ?? ''}
                                  onChange={(event) =>
                                    field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={quickForm.control}
                            name="cellWidthMm"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="sr-only">Width</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="W"
                                    value={field.value ?? ''}
                                    onChange={(event) =>
                                      field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                                    }
                                  />
                                </FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={quickForm.control}
                            name="cellLengthMm"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="sr-only">Length</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="L"
                                    value={field.value ?? ''}
                                    onChange={(event) =>
                                      field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                                    }
                                  />
                                </FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="cellShape"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Shape</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Shape" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="round">Round</SelectItem>
                                  <SelectItem value="square">Square</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="area"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Area</FormLabel>
                              <FormControl>
                                {watchedWidth && watchedLength ? (
                                  <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                                    {((watchedWidth * watchedLength) / 1_000_000).toFixed(4)}
                                  </div>
                                ) : (
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    placeholder="Auto"
                                    value={field.value ?? ''}
                                    onChange={(event) =>
                                      field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                                    }
                                  />
                                )}
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={handleQuickAdd}>
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  </Form>

                  {sortedSizes.map((size) => (
                    <TableRow key={size.id}>
                      <TableCell className="px-4 py-2 font-medium">{size.name}</TableCell>
                      <TableCell className="px-4 py-2">{formatType(size.containerType)}</TableCell>
                      <TableCell className="px-4 py-2">{size.cellMultiple ?? 1}</TableCell>
                      <TableCell className="px-4 py-2">{size.trayQuantity ?? '—'}</TableCell>
                      <TableCell className="px-4 py-2">{size.shelfQuantity ?? 0}</TableCell>
                      <TableCell className="px-4 py-2">{size.trolleyQuantity ?? '—'}</TableCell>
                      <TableCell className="px-4 py-2">{size.cellVolumeL ?? '—'}</TableCell>
                      <TableCell className="px-4 py-2">
                        {size.cellWidthMm && size.cellLengthMm
                          ? `${size.cellWidthMm} × ${size.cellLengthMm}`
                          : '—'}
                      </TableCell>
                      <TableCell className="px-4 py-2">{size.cellShape ? capitalize(size.cellShape) : '—'}</TableCell>
                      <TableCell className="px-4 py-2">{size.area ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => handleEditSize(size)}
                          >
                            <Edit />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" size="icon" variant="destructive">
                                <Trash2 />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete size?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes "{size.name}" from future forms.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSize(size.id!)}>
                                  Yes, delete it
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
          </CardContent>
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingSize ? 'Edit size' : 'Add size'}</DialogTitle>
              <DialogDescription>Define tray, plug, or pot metadata.</DialogDescription>
            </DialogHeader>
            <SizeForm
              size={editingSize}
              onSubmit={handleFormSubmit}
              onCancel={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </DataPageShell>
    </PageFrame>
  );
}

function downloadCsv(headers: string[], rows: string[], filename: string) {
  const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${rows.join('\n')}`;
  const encoded = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encoded);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function formatType(type?: PlantSize['containerType']) {
  if (!type) return '—';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function capitalize(value?: string | null) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeSizeRow(row: any): PlantSize {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    containerType: row.containerType ?? row.container_type ?? 'pot',
    cellMultiple: row.cellMultiple ?? row.cell_multiple ?? 1,
    trayQuantity: row.trayQuantity ?? row.tray_quantity,
    shelfQuantity: row.shelfQuantity ?? row.shelf_quantity ?? 0,
    trolleyQuantity: row.trolleyQuantity ?? row.trolley_quantity,
    area: row.area,
    cellVolumeL: row.cellVolumeL ?? row.cell_volume_l,
    cellDiameterMm: row.cellDiameterMm ?? row.cell_diameter_mm,
    cellWidthMm: row.cellWidthMm ?? row.cell_width_mm,
    cellLengthMm: row.cellLengthMm ?? row.cell_length_mm,
    cellShape: row.cellShape ?? row.cell_shape,
  };
}

