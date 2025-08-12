
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { addSupplierAction, updateSupplierAction, deleteSupplierAction } from '../actions';
import { Skeleton } from '@/components/ui/skeleton';

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subscribeToSuppliers = useCallback(() => {
    if (!user) return;
    setIsLoading(true);
    const q = query(collection(db, 'suppliers'), orderBy('name'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            // Seed initial data if the collection is empty
            const batch = db.batch();
            INITIAL_SUPPLIERS.forEach(supplier => {
              const { id, ...data } = supplier; // Exclude client-side ID
              const docRef = db.collection('suppliers').doc();
              batch.set(docRef, data);
            });
            batch.commit().then(() => console.log("Initial suppliers seeded."));
        } else {
            const suppliersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Supplier);
            setSuppliers(suppliersData);
        }
        setIsLoading(false);
    }, (error) => {
        console.error("Failed to subscribe to supplier updates:", error);
        toast({ variant: 'destructive', title: 'Error loading suppliers', description: error.message });
        setIsLoading(false);
    });

    return unsubscribe;
  }, [user, toast]);

  useEffect(() => {
    const unsubscribe = subscribeToSuppliers();
    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, [subscribeToSuppliers]);


  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setIsFormOpen(true);
  };
  
  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    const supplierToDelete = suppliers.find(s => s.id === supplierId);
    if (supplierToDelete) {
        const result = await deleteSupplierAction(supplierId);
        if (result.success) {
            toast({ title: 'Supplier Deleted', description: `Successfully deleted "${supplierToDelete.name}".` });
        } else {
            toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
        }
    }
  };
  
  const handleFormSubmit = async (supplierData: Omit<Supplier, 'id'> | Supplier) => {
    const isEditing = 'id' in supplierData;

    const result = isEditing
      ? await updateSupplierAction(supplierData as Supplier)
      : await addSupplierAction(supplierData as Omit<Supplier, 'id'>);

    if (result.success) {
      toast({ 
        title: isEditing ? 'Supplier Updated' : 'Supplier Added', 
        description: `Successfully ${isEditing ? 'updated' : 'added'} "${result.data?.name}".` 
      });
      setIsFormOpen(false);
      setEditingSupplier(null);
    } else {
      toast({ 
        variant: 'destructive', 
        title: isEditing ? 'Update Failed' : 'Add Failed', 
        description: result.error 
      });
    }
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
    reader.onload = async (e) => {
        const text = e.target?.result as string;
        try {
            const rows = text.split('\n').filter(row => row.trim() !== '');
            const headerLine = rows.shift()?.trim() || '';
            const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, '') as keyof Supplier);
            
            const requiredHeaders: (keyof Supplier)[] = ['name'];
            if (!requiredHeaders.every(h => headers.includes(h))) {
                throw new Error('CSV headers are missing or incorrect. Required: ' + requiredHeaders.join(', '));
            }

            for (const row of rows) {
                const values = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)!.map(v => v.replace(/"/g, '').trim());
                const supplierData: any = {};
                headers.forEach((header, i) => {
                    supplierData[header] = values[i] || '';
                });
                await addSupplierAction(supplierData);
            }
            
            toast({ title: 'Import Successful', description: `${rows.length} suppliers have been imported.` });
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
          {isLoading ? (
             <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
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
                {suppliers.map((supplier) => (
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
          )}
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
