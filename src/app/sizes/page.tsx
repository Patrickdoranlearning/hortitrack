
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, Edit, Download, Upload } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { INITIAL_PLANT_SIZES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import type { PlantSize } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { SizeForm } from '@/components/size-form';
import { useAuth } from '@/hooks/use-auth';
import { addSizeAction, updateSizeAction, deleteSizeAction } from '../actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection } from '@/hooks/use-collection';


export default function SizesPage() {
  const { user, loading: authLoading } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<PlantSize | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: sizesData, loading: sizesLoading } = useCollection<PlantSize>('sizes', INITIAL_PLANT_SIZES);
  const sizes = sizesData || [];
  const isLoading = authLoading || sizesLoading;

  const handleAddSize = () => {
    setEditingSize(null);
    setIsFormOpen(true);
  };

  const handleEditSize = (size: PlantSize) => {
    setEditingSize(size);
    setIsFormOpen(true);
  };

  const handleDeleteSize = async (sizeId: string) => {
    const sizeToDelete = sizes.find(s => s.id === sizeId);
    if (sizeToDelete) {
      const result = await deleteSizeAction(sizeId);
      if (result.success) {
        toast({ title: 'Size Deleted', description: `Successfully deleted "${sizeToDelete.name}".` });
      } else {
        toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
      }
    }
  };

  const handleFormSubmit = async (data: Omit<PlantSize, 'id'> | PlantSize) => {
    const isEditing = 'id' in data;

    const result = isEditing
      ? await updateSizeAction(data as PlantSize)
      : await addSizeAction(data as Omit<PlantSize, 'id'>);

    if (result.success) {
      toast({
        title: isEditing ? 'Size Updated' : 'Size Added',
        description: `Successfully ${isEditing ? 'updated' : 'added'} "${result.data?.name}".`
      });
      setIsFormOpen(false);
      setEditingSize(null);
    } else {
      toast({
        variant: 'destructive',
        title: isEditing ? 'Update Failed' : 'Add Failed',
        description: result.error
      });
    }
  };

  const handleDownloadData = () => {
    const headers: (keyof Omit<PlantSize, 'id'>)[] = ['name', 'containerType', 'area', 'shelfQuantity', 'multiple'];
    const csvRows = sizes.map(s =>
      headers.map(header => `"${s[header] || ''}"`).join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(',') + '\n'
      + csvRows.join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "plant_sizes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      try {
        const rows = text.split('\n').filter(row => row.trim() !== '');
        const headerLine = rows.shift()?.trim() || '';
        const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, '') as keyof PlantSize);

        const requiredHeaders: (keyof PlantSize)[] = ['name', 'containerType', 'area', 'shelfQuantity'];
        if (!requiredHeaders.every(h => headers.includes(h))) {
          throw new Error('CSV headers are missing or incorrect. Required: ' + requiredHeaders.join(', '));
        }

        for (const row of rows) {
          const values = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)!.map(v => v.replace(/"/g, '').trim());
          const sizeData: any = {};
          headers.forEach((header, i) => {
            sizeData[header] = values[i] || '';
          });

          await addSizeAction(sizeData);
        }

        toast({ title: 'Import Successful', description: `${rows.length} sizes have been imported.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Import Failed', description: error.message });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const customSizeSort = (a: PlantSize, b: PlantSize) => {
    const typeOrder: Record<string, number> = { 'Pot': 1, 'Tray': 2, 'Bareroot': 3 };

    const typeA = typeOrder[a.containerType || ''] || 99;
    const typeB = typeOrder[b.containerType || ''] || 99;

    if (typeA !== typeB) {
      return typeA - typeB;
    }

    const nameA = a.name ?? "";
    const nameB = b.name ?? "";

    const sizeA = Number.parseFloat(nameA);
    const sizeB = Number.parseFloat(nameB);
    const hasNumericSizes = !Number.isNaN(sizeA) && !Number.isNaN(sizeB);

    if (a.containerType === 'Pot' && hasNumericSizes) {
      return sizeA - sizeB;
    }

    if (a.containerType === 'Tray' && hasNumericSizes) {
      return sizeB - sizeA;
    }

    // Fallback to lexical ordering for non-numeric names or other container types.
    return nameA.localeCompare(nameB);
  };

  return (
    <>
      <div className="container mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Plant Sizes</h1>
            <p className="text-muted-foreground">The master list of all standard plant/container sizes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/settings">
                <ArrowLeft />
                Back to Data Management
              </Link>
            </Button>
            <Button variant="outline" onClick={handleDownloadData}><Download /> Download Data</Button>
            <Button onClick={() => fileInputRef.current?.click()}><Upload /> Upload CSV</Button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
            <Button onClick={handleAddSize}>
              <Plus />
              Add New Size
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manage Sizes</CardTitle>
            <CardDescription>Add, edit, or remove sizes from the list used in batch forms.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Area (m²)</TableHead>
                    <TableHead>Shelf Quantity</TableHead>
                    <TableHead>Multiple</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sizes.sort(customSizeSort).map((size) => (
                    <TableRow key={size.id}>
                      <TableCell className="font-medium">{size.name}</TableCell>
                      <TableCell>{size.containerType}</TableCell>
                      <TableCell>{size.area}</TableCell>
                      <TableCell>{size.shelfQuantity}</TableCell>
                      <TableCell>{size.multiple}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button type="button" size="icon" variant="outline" onClick={() => handleEditSize(size)}><Edit /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" size="icon" variant="destructive"><Trash2 /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the "{size.name}" size. This action cannot be undone.
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
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSize ? "Edit Size" : "Add Size"}</DialogTitle>
            <DialogDescription>Define container/tray sizes and multiples.</DialogDescription>
          </DialogHeader>
          <SizeForm
            size={editingSize}
            onSubmit={handleFormSubmit}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
