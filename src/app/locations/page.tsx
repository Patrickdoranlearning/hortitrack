
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, Edit, Check, X, Sun, Wind, Download, Upload } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { NurseryLocation } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
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
import * as z from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { addLocationAction, updateLocationAction, deleteLocationAction } from '../actions';
import { Skeleton } from '@/components/ui/skeleton';
import { INITIAL_LOCATIONS } from '@/lib/locations';
import { useCollection } from '@/hooks/use-collection';


const locationFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Location name is required.'),
  area: z.coerce.number().min(0, 'Area must be a positive number.'),
  isCovered: z.boolean(),
  nursery: z.string().min(1, 'Nursery is required.'),
  type: z.string().min(1, 'Location type is required.'),
});
type LocationFormValues = z.infer<typeof locationFormSchema>;


export default function LocationsPage() {
  const { user } = useAuth();
  const { data: rawLocations, loading: isLoading } = useCollection<NurseryLocation>('nursery_locations');
  const locations = rawLocations || [];

  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      id: '',
      name: '',
      area: 0,
      isCovered: false,
      nursery: 'Main',
      type: '',
    }
  });

  // Removed manual subscription logic as useCollection handles it

  const handleAddNew = () => {
    form.reset({ id: '', name: '', area: 0, isCovered: false, nursery: 'Main', type: '' });
    setEditingLocationId('new');
  };

  const handleEdit = (location: NurseryLocation) => {
    setEditingLocationId(location.id);
    form.reset(location);
  };

  const handleCancelEdit = () => {
    setEditingLocationId(null);
    form.reset({ id: '', name: '', area: 0, isCovered: false, nursery: 'Main', type: '' });
  }

  const handleDelete = async (locationId: string) => {
    const locationToDelete = locations.find(loc => loc.id === locationId);
    if (locationToDelete) {
      const result = await deleteLocationAction(locationId);
      if (result.success) {
        toast({ title: 'Location Deleted', description: `Successfully deleted "${locationToDelete.name}".` });
      } else {
        toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
      }
    }
  };

  const onSubmit = async (data: LocationFormValues) => {
    const isNew = editingLocationId === 'new';

    if (locations.some(loc => loc.name.toLowerCase() === data.name.toLowerCase() && (isNew || loc.id !== data.id))) {
      toast({ variant: 'destructive', title: 'Duplicate Name', description: 'A location with this name already exists.' });
      return;
    }

    const { id, ...locationData } = data;
    const result = isNew
      ? await addLocationAction(locationData as Omit<NurseryLocation, 'id'>)
      : await updateLocationAction({ ...locationData, id: editingLocationId! });

    if (result.success) {
      toast({
        title: isNew ? 'Location Added' : 'Location Updated',
        description: `Successfully ${isNew ? 'added' : 'updated'} "${result.data?.name}".`
      });
      setEditingLocationId(null);
      form.reset();
    } else {
      toast({
        variant: 'destructive',
        title: isNew ? 'Add Failed' : 'Update Failed',
        description: result.error
      });
    }
  };

  const handleDownloadData = () => {
    const headers = ['name', 'nursery', 'type', 'area', 'isCovered'];
    const csvRows = locations.map(loc =>
      [loc.name, loc.nursery, loc.type, loc.area, loc.isCovered].join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(',') + '\n'
      + csvRows.join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "locations_data.csv");
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
        const headers = rows.shift()?.trim().split(',').map(h => h.trim()) || [];

        const requiredHeaders = ['name', 'nursery', 'type', 'area', 'isCovered'];
        if (!requiredHeaders.every(h => headers.includes(h))) {
          throw new Error('CSV headers are missing or incorrect. Required: ' + requiredHeaders.join(', '));
        }

        for (const row of rows) {
          const values = row.trim().split(',');
          const locationData: any = {};
          headers.forEach((header, i) => {
            locationData[header] = values[i]?.trim();
          });

          const dataToSave: Omit<NurseryLocation, 'id'> = {
            name: locationData.name || '',
            nursery: locationData.nursery || 'Main',
            type: locationData.type || 'Tunnel',
            area: parseInt(locationData.area, 10) || 0,
            isCovered: locationData.isCovered?.toLowerCase() === 'true',
          };
          await addLocationAction(dataToSave);
        }
        toast({ title: 'Import Successful', description: `${rows.length} locations have been processed.` });
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

  const renderEditRow = (id: 'new' | string) => {
    return (
      <TableRow key={id} className="bg-muted/50">
        <Form {...form}>
          <TableCell>
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormControl><Input {...field} placeholder="New Location Name" /></FormControl></FormItem>
            )} />
          </TableCell>
          <TableCell>
            <FormField control={form.control} name="nursery" render={({ field }) => (
              <FormItem>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select nursery" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem key="main" value="Main">Main</SelectItem>
                    <SelectItem key="alberts" value="Alberts">Alberts</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </TableCell>
          <TableCell>
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem key="glasshouse" value="Glasshouse">Glasshouse</SelectItem>
                    <SelectItem key="tunnel" value="Tunnel">Tunnel</SelectItem>
                    <SelectItem key="section" value="Section">Section</SelectItem>
                    <SelectItem key="prophouse" value="Prophouse">Prophouse</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </TableCell>
          <TableCell>
            <FormField control={form.control} name="area" render={({ field }) => (
              <FormItem><FormControl><Input type="number" {...field} placeholder="Area in m²" onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl></FormItem>
            )} />
          </TableCell>
          <TableCell>
            <FormField control={form.control} name="isCovered" render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-2">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <Label>Covered</Label>
                </div>
              </FormItem>
            )} />
          </TableCell>
          <TableCell className="text-right">
            <div className="flex gap-2 justify-end">
              <Button size="icon" onClick={form.handleSubmit(onSubmit)}><Check /></Button>
              <Button size="icon" variant="ghost" onClick={handleCancelEdit}><X /></Button>
            </div>
          </TableCell>
        </Form>
      </TableRow>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 font-headline text-4xl">Nursery Locations</h1>
          <p className="text-muted-foreground">The master list of all nursery locations, their size, and type.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings">
            <ArrowLeft />
            Back to Data Management
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Manage Locations</CardTitle>
              <CardDescription>Add, edit, or remove locations from the master list.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownloadData}><Download /> Download Data</Button>
              <Button onClick={() => fileInputRef.current?.click()}><Upload /> Upload CSV</Button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
            </div>
          </div>
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
                  <TableHead className="w-[30%]">Name</TableHead>
                  <TableHead>Nursery</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Area (m²)</TableHead>
                  <TableHead>Covered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.sort((a, b) => (a?.name || '').localeCompare(b?.name || '')).map(location => {
                  if (editingLocationId === location.id) {
                    return renderEditRow(location.id);
                  }
                  return (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">{location.name}</TableCell>
                      <TableCell>{location.nursery || 'N/A'}</TableCell>
                      <TableCell>{location.type || 'N/A'}</TableCell>
                      <TableCell>{location.area.toLocaleString()} m²</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {location.isCovered ? <Sun className="text-amber-500" /> : <Wind className="text-blue-400" />}
                          <span>{location.isCovered ? 'Covered' : 'Uncovered'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button type="button" size="icon" variant="outline" onClick={() => handleEdit(location)}><Edit /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" size="icon" variant="destructive"><Trash2 /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the "{location.name}" location. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(location.id)}>
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
                {editingLocationId === 'new' && renderEditRow('new')}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleAddNew} disabled={!!editingLocationId}>
            <Plus />
            Add New Location
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
