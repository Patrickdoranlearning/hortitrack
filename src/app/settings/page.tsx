
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, ArrowLeft } from 'lucide-react';
import { INITIAL_NURSERY_LOCATIONS, INITIAL_PLANT_SIZES } from '@/lib/constants';
import Link from 'next/link';

export default function SettingsPage() {
  const [locations, setLocations] = useState<string[]>([]);
  const [newLocation, setNewLocation] = useState('');

  const [sizes, setSizes] = useState<string[]>([]);
  const [newSize, setNewSize] = useState('');
  
  const [isClient, setIsClient] = useState(false);

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

    const storedSizesRaw = localStorage.getItem('plantSizes');
    if (storedSizesRaw) {
      const storedSizes = JSON.parse(storedSizesRaw);
      if (storedSizes && storedSizes.length > 0) {
        setSizes(storedSizes);
      } else {
        setSizes(INITIAL_PLANT_SIZES);
      }
    } else {
      setSizes(INITIAL_PLANT_SIZES);
    }
  }, []);
  
  useEffect(() => {
    if(isClient) {
        localStorage.setItem('nurseryLocations', JSON.stringify(locations));
    }
  }, [locations, isClient]);

  useEffect(() => {
    if (isClient) {
        localStorage.setItem('plantSizes', JSON.stringify(sizes));
    }
  }, [sizes, isClient]);


  const handleAddLocation = () => {
    if (newLocation.trim() && !locations.includes(newLocation.trim())) {
      setLocations([...locations, newLocation.trim()]);
      setNewLocation('');
    }
  };

  const handleDeleteLocation = (locationToDelete: string) => {
    setLocations(locations.filter((location) => location !== locationToDelete));
  };
  
  const handleAddSize = () => {
    if (newSize.trim() && !sizes.includes(newSize.trim())) {
      setSizes([...sizes, newSize.trim()]);
      setNewSize('');
    }
  };

  const handleDeleteSize = (sizeToDelete: string) => {
    setSizes(sizes.filter((size) => size !== sizeToDelete));
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6">
       <div className="mb-6">
        <Button asChild variant="outline">
            <Link href="/">
                <ArrowLeft />
                Back to Dashboard
            </Link>
        </Button>
      </div>
      <h1 className="mb-6 font-headline text-4xl">Settings</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nursery Locations</CardTitle>
            <CardDescription>Manage the list of available nursery locations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="Add a new location"
                onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
              />
              <Button onClick={handleAddLocation}>
                <Plus /> Add
              </Button>
            </div>
            <ul className="space-y-2">
              {locations.map((location) => (
                <li key={location} className="flex items-center justify-between rounded-md bg-secondary p-2">
                  <span>{location}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteLocation(location)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plant Sizes</CardTitle>
            <CardDescription>Manage the list of available plant container sizes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                placeholder="Add a new size"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSize()}
              />
              <Button onClick={handleAddSize}>
                <Plus /> Add
              </Button>
            </div>
            <ul className="space-y-2">
              {sizes.map((size) => (
                <li key={size} className="flex items-center justify-between rounded-md bg-secondary p-2">
                  <span>{size}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteSize(size)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
