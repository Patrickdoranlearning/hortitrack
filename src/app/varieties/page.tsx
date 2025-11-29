
'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, Edit } from 'lucide-react';
import Link from 'next/link';
import type { Variety } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { addVarietyAction, updateVarietyAction, deleteVarietyAction } from '../actions';
import { Skeleton } from '@/components/ui/skeleton';
import { VARIETIES as INITIAL_VARIETIES } from '@/lib/varieties';
import { VarietiesCsvButtons } from '@/components/varieties/VarietiesCsvButtons';
import { useCollection } from '@/hooks/use-collection';


export default function VarietiesPage() {
  const { user, loading: authLoading } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVariety, setEditingVariety] = useState<Variety | null>(null);
  const { toast } = useToast();

  const { data: varietiesData, loading: varietiesLoading } = useCollection<Variety>('varieties', INITIAL_VARIETIES);
  const varieties = varietiesData || [];
  const [sortConfig, setSortConfig] = useState<{ key: keyof Variety; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });
  const isLoading = authLoading || varietiesLoading;

  const sortedVarieties = useMemo(() => {
    return [...varieties].sort((a, b) => {
      const { key, direction } = sortConfig;
      const left = (a?.[key] ?? '') as string | number | boolean;
      const right = (b?.[key] ?? '') as string | number | boolean;

      if (typeof left === 'number' && typeof right === 'number') {
        return direction === 'asc' ? left - right : right - left;
      }
      if (typeof left === 'boolean' && typeof right === 'boolean') {
        return direction === 'asc'
          ? Number(left) - Number(right)
          : Number(right) - Number(left);
      }

      const leftStr = String(left).toLowerCase();
      const rightStr = String(right).toLowerCase();
      if (leftStr < rightStr) return direction === 'asc' ? -1 : 1;
      if (leftStr > rightStr) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [varieties, sortConfig]);

  const handleSort = (key: keyof Variety) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

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

  const renderSortLabel = (label: string, key: keyof Variety, minWidth?: string) => {
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

  return (
    <>
      <div className="container mx-auto max-w-7xl p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Plant Varieties</h1>
            <p className="text-muted-foreground">The master list of all plant varieties and their attributes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/settings">
                <ArrowLeft />
                Back to Data Management
              </Link>
            </Button>
            <VarietiesCsvButtons />
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
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <Table className="min-w-[1100px] text-sm whitespace-nowrap">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-2 min-w-[180px]">{renderSortLabel('Variety Name', 'name')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[160px]">{renderSortLabel('Common Name', 'commonName')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[140px]">{renderSortLabel('Family', 'family')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[140px]">{renderSortLabel('Category', 'category')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[140px]">{renderSortLabel('Grouping', 'grouping')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[160px]">{renderSortLabel('Flowering Period', 'floweringPeriod')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[160px]">{renderSortLabel('Flower Colour', 'flowerColour')}</TableHead>
                    <TableHead className="px-4 py-2 min-w-[120px]">{renderSortLabel('Evergreen', 'evergreen')}</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedVarieties.map((variety, index) => {
                    const rowKey =
                      variety.id ??
                      (variety.name ? `variety-${variety.name}-${index}` : `variety-${index}`);
                    return (
                    <TableRow key={rowKey}>
                      <TableCell className="px-4 py-2 font-medium">{variety.name}</TableCell>
                      <TableCell className="px-4 py-2">{variety.commonName}</TableCell>
                      <TableCell className="px-4 py-2">{variety.family}</TableCell>
                      <TableCell className="px-4 py-2">{variety.category}</TableCell>
                      <TableCell className="px-4 py-2">{variety.grouping}</TableCell>
                      <TableCell className="px-4 py-2">{variety.floweringPeriod}</TableCell>
                      <TableCell className="px-4 py-2">{variety.flowerColour}</TableCell>
                      <TableCell className="px-4 py-2">{variety.evergreen ? 'Yes' : 'No'}</TableCell>
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
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingVariety ? "Edit Variety" : "Add Variety"}</DialogTitle>
              <DialogDescription>Family/category is used to prefill batch info.</DialogDescription>
            </DialogHeader>
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
