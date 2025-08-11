
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { VARIETIES, type Variety } from '@/lib/varieties';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VarietyForm } from '@/components/variety-form';
import { useToast } from '@/hooks/use-toast';

export default function VarietiesPage() {
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // In a real app, this would be a database call.
    // For now, we'll use localStorage to simulate persistence.
    const storedVarietiesRaw = localStorage.getItem('varieties');
    if (storedVarietiesRaw) {
      const storedVarieties = JSON.parse(storedVarietiesRaw);
      if (storedVarieties && storedVarieties.length > 0) {
        setVarieties(storedVarieties);
      } else {
        setVarieties(VARIETIES);
      }
    } else {
      setVarieties(VARIETIES);
    }
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('varieties', JSON.stringify(varieties));
    }
  }, [varieties, isClient]);

  const handleAddVariety = () => {
    setIsFormOpen(true);
  };
  
  const handleFormSubmit = (newVariety: Variety) => {
    const isDuplicate = varieties.some(v => v.name.toLowerCase() === newVariety.name.toLowerCase());
    if (isDuplicate) {
        toast({ variant: 'destructive', title: 'Duplicate Variety', description: `The variety "${newVariety.name}" already exists.` });
        return;
    }
    setVarieties(prev => [...prev, newVariety].sort((a,b) => a.name.localeCompare(b.name)));
    toast({ title: 'Variety Added', description: `Successfully added "${newVariety.name}".` });
    setIsFormOpen(false);
  };

  if (!isClient) {
    return (
       <div className="flex items-center justify-center h-screen">
        <div className="text-2xl">Loading Varieties...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
            <h1 className="mb-1 font-headline text-4xl">Plant Varieties</h1>
            <p className="text-muted-foreground">The master list of all plant varieties.</p>
        </div>
        <div className="flex gap-2">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variety Name</TableHead>
                <TableHead>Plant Family</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {varieties.map((variety) => (
                <TableRow key={variety.name}>
                  <TableCell className="font-medium">{variety.name}</TableCell>
                  <TableCell>{variety.family}</TableCell>
                  <TableCell>{variety.category}</TableCell>
                  <TableCell>
                    {/* Placeholder for future edit/delete actions */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
            <VarietyForm
                onSubmit={handleFormSubmit}
                onCancel={() => setIsFormOpen(false)}
            />
        </DialogContent>
      </Dialog>
    </div>
  );
}

    