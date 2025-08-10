
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, X, Save } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { INITIAL_NURSERY_LOCATIONS } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function LocationsPage() {
  const [locations, setLocations] = useState<string[]>([]);
  const [newLocation, setNewLocation] = useState('');
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    const storedLocationsRaw = localStorage.getItem('nurseryLocations');
    if (storedLocationsRaw) {
        const storedLocations = JSON.parse(storedLocationsRaw);
        if (storedLocations && storedLocations.length > 0) {
            setLocations(storedLocations);
        } else {
            setLocations(INITIAL_NURSERY_LOCATIONS);
        }
    } else {
        setLocations(INITIAL_NURSERY_LOCATIONS);
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('nurseryLocations', JSON.stringify(locations));
    }
  }, [locations, isClient]);

  const handleAddLocation = () => {
    if (newLocation.trim() && !locations.includes(newLocation.trim())) {
      setLocations([...locations, newLocation.trim()].sort());
      setNewLocation('');
      toast({ title: 'Location Added', description: `Successfully added "${newLocation.trim()}".` });
    } else if (locations.includes(newLocation.trim())) {
        toast({ variant: 'destructive', title: 'Duplicate Location', description: 'This location already exists.' });
    }
  };

  const handleRemoveLocation = (locationToRemove: string) => {
    setLocations(locations.filter(loc => loc !== locationToRemove));
    toast({ title: 'Location Removed', description: `Successfully removed "${locationToRemove}".` });
  };
  
  if (!isClient) {
    return null; // Or a loading spinner
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
            <h1 className="mb-1 font-headline text-4xl">Nursery Locations</h1>
            <p className="text-muted-foreground">The master list of all nursery locations.</p>
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
          <CardDescription>Add or remove locations from the list used in batch forms.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex gap-2 mb-4">
                <Input 
                    placeholder="Enter new location name..."
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
                />
                <Button onClick={handleAddLocation}>
                    <Plus />
                    Add Location
                </Button>
            </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location}>
                  <TableCell className="font-medium">{location}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveLocation(location)}>
                        <X className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Remove</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
