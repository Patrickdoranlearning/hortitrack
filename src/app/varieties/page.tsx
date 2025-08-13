
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, Edit } from 'lucide-react';
import Link from 'next/link';
import type { Variety } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VarietyForm } from '@/components/variety-form';
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
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, writeBatch, doc } from 'firebase/firestore';
import { addVarietyAction, updateVarietyAction, deleteVarietyAction } from '../actions';
import { Skeleton } from '@/components/ui/skeleton';
import { VARIETIES as INITIAL_VARIETIES } from '@/lib/varieties';


export default function VarietiesPage() {
  const { user } = useAuth();
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVariety, setEditingVariety] = useState<Variety | null>(null);
  const { toast } = useToast();

  const subscribeToVarieties = useCallback(() => {
    if (!user) return;
    setIsLoading(true);
    const q = query(collection(db, 'varieties'), orderBy('name'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          console.log("Varieties collection is empty, seeding initial data...");
          const batch = writeBatch(db);
          INITIAL_VARIETIES.forEach(variety => {
            const docRef = doc(collection(db, "varieties"));
            batch.set(docRef, variety);
          });
          batch.commit().then(() => console.log("Initial varieties seeded successfully."));
        } else {
          const varietiesData = snapshot.docs.map(
            (doc) => ({ ...doc.data(), id: doc.id }) as Variety
          );
          setVarieties(varietiesData);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to subscribe to variety updates:', error);
        toast({ variant: 'destructive', title: 'Error loading varieties', description: error.message });
        setIsLoading(false);
      }
    );
    return unsubscribe;
  }, [user, toast]);

  useEffect(() => {
    const unsubscribe = subscribeToVarieties();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [subscribeToVarieties]);


  const handleAddVariety = () => {
    setEditingVariety(null);
    setIsFormOpen(true);
  };
  
  const handleEditVariety = (variety: Variety) => {
    setEditingVariety(variety);
    setIsFormOpen(true);
  };

  const handleDeleteVariety = async (varietyId: string) => {
    const varietyToDelete = varieties.find(v => v.id === varietyId);
    if (!varietyToDelete) return;

    const result = await deleteVarietyAction(varietyId);
    if (result.success) {
        toast({ title: 'Variety Deleted', description: `Successfully deleted "${varietyToDelete.name}".` });
    } else {
        toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
    }
  };
  
  const handleFormSubmit = async (varietyData: Omit<Variety, 'id'> | Variety) => {
    const isEditing = 'id' in varietyData;

    const result = isEditing
      ? await updateVarietyAction(varietyData as Variety)
      : await addVarietyAction(varietyData);

    if (result.success) {
      toast({ 
        title: isEditing ? 'Variety Updated' : 'Variety Added', 
        description: `Successfully ${isEditing ? 'updated' : 'added'} "${result.data?.name}".` 
      });
      setIsFormOpen(false);
      setEditingVariety(null);
    } else {
      toast({ 
        variant: 'destructive', 
        title: isEditing ? 'Update Failed' : 'Add Failed', 
        description: result.error 
      });
    }
  };

  return (
    <>
    <div className="container mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
            <h1 className="mb-1 font-headline text-4xl">Plant Varieties</h1>
            <p className="text-muted-foreground">The master list of all plant varieties and their attributes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
                <Link href="/settings">
                    <ArrowLeft />
                    Back to Data Management
                </Link>
            </Button>
            <Button onClick={handleAddVariety}>
                <Plus />
                Add New Variety
            </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Varieties Golden Table</CardTitle>
          <CardDescription>This is the master list of varieties used for auto-completing new batch forms.</CardDescription>
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
                  <TableHead>Variety Name</TableHead>
                  <TableHead>Common Name</TableHead>
                  <TableHead>Family</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Grouping</TableHead>
                  <TableHead>Flowering Period</TableHead>
                  <TableHead>Flower Colour</TableHead>
                  <TableHead>Evergreen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {varieties.map((variety) => (
                  <TableRow key={variety.id}>
                    <TableCell className="font-medium">{variety.name}</TableCell>
                    <TableCell>{variety.commonName}</TableCell>
                    <TableCell>{variety.family}</TableCell>
                    <TableCell>{variety.category}</TableCell>
                    <TableCell>{variety.grouping}</TableCell>
                    <TableCell>{variety.floweringPeriod}</TableCell>
                    <TableCell>{variety.flowerColour}</TableCell>
                    <TableCell>{variety.evergreen}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                          <Button type="button" size="icon" variant="outline" onClick={() => handleEditVariety(variety)}><Edit /></Button>
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button type="button" size="icon" variant="destructive"><Trash2 /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      This will permanently delete the "{variety.name}" variety. This action cannot be undone.
                                  </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteVariety(variety.id!)}>
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
            <VarietyForm
                variety={editingVariety}
                onSubmit={handleFormSubmit}
                onCancel={() => {
                    setIsFormOpen(false);
                    setEditingVariety(null);
                }}
            />
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}

