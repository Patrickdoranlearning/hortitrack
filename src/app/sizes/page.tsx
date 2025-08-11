
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, Edit, Download, Upload } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { INITIAL_PLANT_SIZES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import type { PlantSize } from '@/lib/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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


export default function SizesPage() {
  const [sizes, setSizes] = useState<PlantSize[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<PlantSize | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedSizesRaw = localStorage.getItem('plantSizes');
    if (storedSizesRaw) {
        try {
            const storedSizes = JSON.parse(storedSizesRaw);
            if (Array.isArray(storedSizes) && storedSizes.length > 0) {
                setSizes(storedSizes);
            } else {
                setSizes(INITIAL_PLANT_SIZES);
            }
        } catch(e) {
            console.error("Failed to parse stored sizes:", e);
            setSizes(INITIAL_PLANT_SIZES);
        }
    } else {
      setSizes(INITIAL_PLANT_SIZES);
    }
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('plantSizes', JSON.stringify(sizes));
    }
  }, [sizes, isClient]);

  const handleAddSize = () => {
    setEditingSize(null);
    setIsFormOpen(true);
  };

  const handleEditSize = (size: PlantSize) => {
    setEditingSize(size);
    setIsFormOpen(true);
  };
  
  const handleDeleteSize = (sizeId: string) => {
    const sizeToDelete = sizes.find(s => s.id === sizeId);
    if (sizeToDelete) {
        setSizes(sizes.filter(s => s.id !== sizeId));
        toast({ title: 'Size Deleted', description: `Successfully deleted "${sizeToDelete.size}".` });
    }
  };

  const handleFormSubmit = (data: PlantSize) => {
    const isNew = !editingSize;

    if (sizes.some(s => s.size.toLowerCase() === data.size.toLowerCase() && (isNew || s.id !== data.id))) {
        toast({ variant: 'destructive', title: 'Duplicate Size', description: 'A size with this name already exists.' });
        return;
    }

    if (isNew) {
      const newSizeWithId = { ...data, id: `size_${Date.now()}` };
      setSizes(prev => [...prev, newSizeWithId].sort((a,b) => a.size.localeCompare(b.size)));
      toast({ title: 'Size Added', description: `Successfully added "${data.size}".` });
    } else {
      setSizes(sizes.map(s => s.id === editingSize.id ? { ...s, ...data } : s));
      toast({ title: 'Size Updated', description: `Successfully updated "${data.size}".` });
    }
    setIsFormOpen(false);
    setEditingSize(null);
  };

  const handleDownloadData = () => {
    const headers: (keyof PlantSize)[] = ['size', 'type', 'area', 'shelfQuantity', 'multiple'];
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
    reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
            const rows = text.split('\n').filter(row => row.trim() !== '');
            const headerLine = rows.shift()?.trim() || '';
            const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, '') as keyof PlantSize);
            
            const requiredHeaders: (keyof PlantSize)[] = ['size', 'type', 'area', 'shelfQuantity'];
            if (!requiredHeaders.every(h => headers.includes(h))) {
                throw new Error('CSV headers are missing or incorrect. Required: ' + requiredHeaders.join(', '));
            }

            const newSizes = rows.map((row, index) => {
                const values = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)!.map(v => v.replace(/"/g, '').trim());
                const sizeData: any = {};
                headers.forEach((header, i) => {
                    sizeData[header] = values[i] || '';
                });

                return {
                    id: `csv_${Date.now()}_${index}`,
                    ...sizeData
                } as PlantSize;
            });
            
            setSizes(newSizes);
            toast({ title: 'Import Successful', description: `${newSizes.length} sizes have been loaded.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Import Failed', description: error.message });
        } finally {
            if(fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    reader.readAsText(file);
  };
  
  if (!isClient) {
    return (
       <div className="flex items-center justify-center h-screen">
        <div className="text-2xl">Loading Sizes...</div>
      </div>
    );
  }

  return (
    <>
    <div className="container mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
            <h1 className="mb-1 font-headline text-4xl">Plant Sizes</h1>
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
              {sizes.sort((a,b) => a.size.localeCompare(b.size)).map((size) => (
                <TableRow key={size.id}>
                  <TableCell className="font-medium">{size.size}</TableCell>
                  <TableCell>{size.type}</TableCell>
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
                                    This will permanently delete the "{size.size}" size. This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSize(size.id)}>
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
        </CardContent>
      </Card>
    </div>

    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
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
