
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, Edit, Check, X, Sun, Wind } from 'lucide-react';
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

const INITIAL_LOCATIONS: NurseryLocation[] = [
    { id: 'gh1', name: 'Greenhouse 1', area: 1000, isCovered: true, nursery: 'Doran Nurseries', type: 'Glasshouse' },
    { id: 'gh2', name: 'Greenhouse 2', area: 1200, isCovered: true, nursery: 'Doran Nurseries', type: 'Glasshouse' },
    { id: 'fa1', name: 'Field A1', area: 5000, isCovered: false, nursery: 'Second Nursery', type: 'Section' },
    { id: 'sh1', name: 'Shade House 1', area: 800, isCovered: true, nursery: 'Doran Nurseries', type: 'Tunnel' },
];

const locationFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Location name is required.'),
  area: z.coerce.number().min(0, 'Area must be a positive number.'),
  isCovered: z.boolean(),
  nursery: z.string().optional(),
  type: z.string().min(1, 'Location type is required.'),
});
type LocationFormValues = z.infer<typeof locationFormSchema>;


export default function LocationsPage() {
  const [locations, setLocations] = useState<NurseryLocation[]>([]);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
        id: '',
        name: '',
        area: 0,
        isCovered: false,
        nursery: 'Doran Nurseries',
        type: '',
    }
  });

  useEffect(() => {
    setIsClient(true);
    const storedLocationsRaw = localStorage.getItem('nurseryLocations');
    if (storedLocationsRaw) {
      try {
        const storedLocations: NurseryLocation[] = JSON.parse(storedLocationsRaw);
        if (Array.isArray(storedLocations) && storedLocations.length > 0) {
          const validLocations = storedLocations.filter(loc => typeof loc.name === 'string' && loc.name.length > 0);
          setLocations(validLocations.length > 0 ? validLocations : INITIAL_LOCATIONS);
        } else {
          setLocations(INITIAL_LOCATIONS);
        }
      } catch (e) {
          console.error("Failed to parse stored locations from localStorage:", e);
          setLocations(INITIAL_LOCATIONS);
      }
    } else {
      setLocations(INITIAL_LOCATIONS);
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('nurseryLocations', JSON.stringify(locations));
    }
  }, [locations, isClient]);

  const handleAddNew = () => {
    form.reset({ id: '', name: '', area: 0, isCovered: false, nursery: 'Doran Nurseries', type: '' });
    setEditingLocationId('new');
  };

  const handleEdit = (location: NurseryLocation) => {
    setEditingLocationId(location.id);
    form.reset(location);
  };
  
  const handleCancelEdit = () => {
      setEditingLocationId(null);
      form.reset({ id: '', name: '', area: 0, isCovered: false, nursery: 'Doran Nurseries', type: '' });
  }

  const handleDelete = (locationId: string) => {
    const locationToDelete = locations.find(loc => loc.id === locationId);
    if (locationToDelete) {
        setLocations(locations.filter(loc => loc.id !== locationId));
        toast({ title: 'Location Deleted', description: `Successfully deleted "${locationToDelete.name}".` });
    }
  };

  const onSubmit = (data: LocationFormValues) => {
    const isNew = editingLocationId === 'new';

    if (locations.some(loc => loc.name.toLowerCase() === data.name.toLowerCase() && (isNew || loc.id !== data.id))) {
        toast({ variant: 'destructive', title: 'Duplicate Name', description: 'A location with this name already exists.' });
        return;
    }

    if (isNew) {
      const newLocation = { ...data, id: `loc_${Date.now()}` };
      setLocations(prev => [...prev, newLocation].sort((a,b) => {
        const nameA = a?.name || '';
        const nameB = b?.name || '';
        return nameA.localeCompare(nameB);
      }));
      toast({ title: 'Location Added', description: `Successfully added "${data.name}".` });
    } else {
      setLocations(locations.map(loc => loc.id === editingLocationId ? { ...loc, ...data } : loc));
      toast({ title: 'Location Updated', description: `Successfully updated "${data.name}".` });
    }
    setEditingLocationId(null);
    form.reset();
  };
  

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-2xl">Loading Locations...</div>
      </div>
    );
  }
  
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
                          <SelectItem value="Doran Nurseries">Doran Nurseries</SelectItem>
                          <SelectItem value="Second Nursery">Second Nursery</SelectItem>
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
                          <SelectItem value="Glasshouse">Glasshouse</SelectItem>
                          <SelectItem value="Tunnel">Tunnel</SelectItem>
                          <SelectItem value="Section">Section</SelectItem>
                          <SelectItem value="Prop House">Prop House</SelectItem>
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
          <CardTitle>Manage Locations</CardTitle>
          <CardDescription>Add, edit, or remove locations from the master list.</CardDescription>
        </CardHeader>
        <CardContent>
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
                  {locations.sort((a,b) => (a?.name || '').localeCompare(b?.name || '')).map(location => {
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
