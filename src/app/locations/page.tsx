
'use client';

import { useState, useEffect, useRef } from 'react';
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

const INITIAL_LOCATIONS: NurseryLocation[] = [
    { id: 't1', name: 'T1', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't2', name: 'T2', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't3', name: 'T3', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't4', name: 'T4', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't5', name: 'T5', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't6a', name: 'T6A', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't6b', name: 'T6B', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't6c', name: 'T6C', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't6d', name: 'T6D', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't7a', name: 'T7A', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't7b', name: 'T7B', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't8', name: 'T8', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't9', name: 'T9', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't10', name: 'T10', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't11', name: 'T11', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't12', name: 'T12', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't13a', name: 'T13A', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't13b', name: 'T13B', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't14', name: 'T14', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't15', name: 'T15', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't16', name: 'T16', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't17', name: 'T17', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't18', name: 'T18', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't19', name: 'T19', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't20', name: 'T20', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't21a', name: 'T21A', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't21b', name: 'T21B', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't22', name: 'T22', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't23', name: 'T23', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't24', name: 'T24', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't25', name: 'T25', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't26', name: 'T26', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't27', name: 'T27', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't28', name: 'T28', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't29', name: 'T29', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't30', name: 'T30', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't31', name: 'T31', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't32a', name: 'T32A', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't32b', name: 'T32B', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't32c', name: 'T32C', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't32d', name: 'T32D', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't32e', name: 'T32E', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't32f', name: 'T32F', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't32g', name: 'T32G', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't35a', name: 'T35A', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't35b', name: 'T35B', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't35c', name: 'T35C', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't35e', name: 'T35E', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't36a', name: 'T36A', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't36b', name: 'T36B', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't36c', name: 'T36C', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't36d', name: 'T36D', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't36e', name: 'T36E', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't37a', name: 'T37A', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't37b', name: 'T37B', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 't37c', name: 'T37C', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 's2', name: 'S2', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's3', name: 'S3', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's4', name: 'S4', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's5', name: 'S5', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's6', name: 'S6', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's7', name: 'S7', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's8', name: 'S8', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's9', name: 'S9', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's10', name: 'S10', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's11', name: 'S11', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's12', name: 'S12', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's13', name: 'S13', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's14', name: 'S14', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 's15', name: 'S15', nursery: 'Main', type: 'Section', area: 100, isCovered: false },
    { id: 'at1', name: 'AT1', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'at2', name: 'AT2', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'at3', name: 'AT3', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'at4', name: 'AT4', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'at5', name: 'AT5', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'at6', name: 'AT6', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'at7', name: 'AT7', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'at8', name: 'AT8', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'at9', name: 'AT9', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'at10', name: 'AT10', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'at11', name: 'AT11', nursery: 'Alberts', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'as1', name: 'AS1', nursery: 'Alberts', type: 'Section', area: 100, isCovered: false },
    { id: 'as2', name: 'AS2', nursery: 'Alberts', type: 'Section', area: 100, isCovered: false },
    { id: 'as3', name: 'AS3', nursery: 'Alberts', type: 'Section', area: 100, isCovered: false },
    { id: 'as4', name: 'AS4', nursery: 'Alberts', type: 'Section', area: 100, isCovered: false },
    { id: 't35d', name: 'T35D', nursery: 'Main', type: 'Tunnel', area: 100, isCovered: true },
    { id: 'agh', name: 'AGH', nursery: 'Alberts', type: 'Glasshouse', area: 100, isCovered: true },
    { id: 'gh', name: 'GH', nursery: 'Main', type: 'Glasshouse', area: 100, isCovered: true },
    { id: 'lous', name: 'Lous', nursery: 'Main', type: 'Prophouse', area: 100, isCovered: true },
];


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
  const [locations, setLocations] = useState<NurseryLocation[]>([]);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
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
  
  const handleDownloadTemplate = () => {
    const headers = ['name', 'nursery', 'type', 'area', 'isCovered'];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "locations_template.csv");
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
            const headers = rows.shift()?.trim().split(',').map(h => h.trim()) || [];
            
            const requiredHeaders = ['name', 'nursery', 'type', 'area', 'isCovered'];
            if (!requiredHeaders.every(h => headers.includes(h))) {
                throw new Error('CSV headers are missing or incorrect. Required: ' + requiredHeaders.join(', '));
            }

            const newLocations = rows.map((row, index) => {
                const values = row.trim().split(',');
                const locationData: any = {};
                headers.forEach((header, i) => {
                    locationData[header] = values[i]?.trim();
                });

                return {
                    id: `csv_${Date.now()}_${index}`,
                    name: locationData.name || '',
                    nursery: locationData.nursery || 'Main',
                    type: locationData.type || 'Tunnel',
                    area: parseInt(locationData.area, 10) || 0,
                    isCovered: locationData.isCovered?.toLowerCase() === 'true',
                } as NurseryLocation;
            });
            
            setLocations(newLocations);
            toast({ title: 'Import Successful', description: `${newLocations.length} locations have been loaded from the CSV file.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Import Failed', description: error.message });
        } finally {
            // Reset file input
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
                          <SelectItem value="Main">Main</SelectItem>
                          <SelectItem value="Alberts">Alberts</SelectItem>
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
                          <SelectItem value="Prophouse">Prophouse</SelectItem>
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
              <Button variant="outline" onClick={handleDownloadTemplate}><Download /> Download Template</Button>
              <Button onClick={() => fileInputRef.current?.click()}><Upload /> Upload CSV</Button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
            </div>
          </div>
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

    