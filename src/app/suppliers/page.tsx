
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, Download, Upload, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { INITIAL_SUPPLIERS } from '@/lib/suppliers';
import type { Supplier } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
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
import { SupplierForm } from '@/components/supplier-form';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedSuppliersRaw = localStorage.getItem('suppliers');
    if (storedSuppliersRaw) {
      try {
        const storedSuppliers = JSON.parse(storedSuppliersRaw);
        if (Array.isArray(storedSuppliers) && storedSuppliers.length > 0) {
          setSuppliers(storedSuppliers);
        } else {
          setSuppliers(INITIAL_SUPPLIERS);
        }
      } catch (e) {
        console.error("Failed to parse stored suppliers:", e);
        setSuppliers(INITIAL_SUPPLIERS);
      }
    } else {
      setSuppliers(INITIAL_SUPPLIERS);
    }
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('suppliers', JSON.stringify(suppliers));
    }
  }, [suppliers, isClient]);

  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setIsFormOpen(true);
  };
  
  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDeleteSupplier = (supplierId: string) => {
    const supplierToDelete = suppliers.find(s => s.id === supplierId);
    if (supplierToDelete) {
        setSuppliers(prev => prev.filter(s => s.id !== supplierId));
        toast({ title: 'Supplier Deleted', description: `Successfully deleted "${supplierToDelete.name}".` });
    }
  };
  
  const handleFormSubmit = (supplierData: Supplier) => {
    const isNew = !editingSupplier;
    
    if (suppliers.some(s => s.name.toLowerCase() === supplierData.name.toLowerCase() && (isNew || s.id !== supplierData.id))) {
        toast({ variant: 'destructive', title: 'Duplicate Supplier', description: 'A supplier with this name already exists.' });
        return;
    }

    if (isNew) {
        const newSupplier = { ...supplierData, id: `sup_${Date.now()}` };
        setSuppliers(prev => [...prev, newSupplier].sort((a,b) => a.name.localeCompare(b.name)));
        toast({ title: 'Supplier Added', description: `Successfully added "${supplierData.name}".` });
    } else {
        setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? { ...s, ...supplierData } : s));
        toast({ title: 'Supplier Updated', description: `Successfully updated "${supplierData.name}".` });
    }
    
    setEditingSupplier(null);
    setIsFormOpen(false);
  };

  const handleDownloadData = () => {
    const headers: (keyof Supplier)[] = ['name', 'address', 'country', 'countryCode', 'producerCode'];
    const csvRows = suppliers.map(s => 
      headers.map(header => `"${s[header] || ''}"`).join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(',') + '\n'
        + csvRows.join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "suppliers_data.csv");
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
            const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, '') as keyof Supplier);
            
            const requiredHeaders: (keyof Supplier)[] = ['name'];
            if (!requiredHeaders.every(h => headers.includes(h))) {
                throw new Error('CSV headers are missing or incorrect. Required: ' + requiredHeaders.join(', '));
            }

            const newSuppliers = rows.map((row, index) => {
                const values = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)!.map(v => v.replace(/"/g, '').trim());
                const supplierData: any = {};
                headers.forEach((header, i) => {
                    supplierData[header] = values[i] || '';
                });

                return {
                    id: `csv_${Date.now()}_${index}`,
                    ...supplierData
                } as Supplier;
            });
            
            setSuppliers(newSuppliers);
            toast({ title: 'Import Successful', description: `${newSuppliers.length} suppliers have been loaded.` });
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
        <div className="text-2xl">Loading Suppliers...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
            <h1 className="mb-1 font-headline text-4xl">Suppliers</h1>
            <p className="text-muted-foreground">The master list of all plant and material suppliers.</p>
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
            <Button onClick={handleAddSupplier}>
                <Plus />
                Add New Supplier
            </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Suppliers Golden Table</CardTitle>
          <CardDescription>This is the master list of suppliers used for creating new batches.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Country Code</TableHead>
                <TableHead>Producer Code</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.sort((a,b) => a.name.localeCompare(b.name)).map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.address}</TableCell>
                  <TableCell>{supplier.country}</TableCell>
                  <TableCell>{supplier.countryCode}</TableCell>
                  <TableCell>{supplier.producerCode}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                        <Button type="button" size="icon" variant="outline" onClick={() => handleEditSupplier(supplier)}><Edit /></Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type="button" size="icon" variant="destructive"><Trash2 /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete the "{supplier.name}" supplier. This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSupplier(supplier.id)}>
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
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
            <SupplierForm
                supplier={editingSupplier}
                onSubmit={handleFormSubmit}
                onCancel={() => {
                    setIsFormOpen(false);
                    setEditingSupplier(null);
                }}
            />
        </DialogContent>
      </Dialog>
    </div>
  );
}
