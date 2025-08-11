
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { INITIAL_PLANT_SIZES } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function SizesPage() {
  const [sizes, setSizes] = useState<string[]>([]);
  const [newSize, setNewSize] = useState('');
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
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
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('plantSizes', JSON.stringify(sizes));
    }
  }, [sizes, isClient]);

  const handleAddSize = () => {
    if (newSize.trim() && !sizes.includes(newSize.trim())) {
      setSizes([...sizes, newSize.trim()].sort((a, b) => {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b);
      }));
      setNewSize('');
      toast({ title: 'Size Added', description: `Successfully added "${newSize.trim()}".` });
    } else if (sizes.includes(newSize.trim())) {
      toast({ variant: 'destructive', title: 'Duplicate Size', description: 'This size already exists.' });
    }
  };

  const handleRemoveSize = (sizeToRemove: string) => {
    setSizes(sizes.filter(s => s !== sizeToRemove));
    toast({ title: 'Size Removed', description: `Successfully removed "${sizeToRemove}".` });
  };
  
  if (!isClient) {
    return (
       <div className="flex items-center justify-center h-screen">
        <div className="text-2xl">Loading Sizes...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
            <h1 className="mb-1 font-headline text-4xl">Plant Sizes</h1>
            <p className="text-muted-foreground">The master list of all standard plant/container sizes.</p>
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
          <CardTitle>Manage Sizes</CardTitle>
          <CardDescription>Add or remove sizes from the list used in batch forms.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex gap-2 mb-4">
                <Input 
                    placeholder="Enter new size..."
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSize()}
                />
                <Button onClick={handleAddSize}>
                    <Plus />
                    Add Size
                </Button>
            </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Size Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sizes.map((size) => (
                <TableRow key={size}>
                  <TableCell className="font-medium">{size}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSize(size)}>
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

    