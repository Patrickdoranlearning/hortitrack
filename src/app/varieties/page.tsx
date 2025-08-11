
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, Download, Upload } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedVarietiesRaw = localStorage.getItem('varieties');
    if (storedVarietiesRaw) {
      try {
        const storedVarieties = JSON.parse(storedVarietiesRaw);
        if (Array.isArray(storedVarieties) && storedVarieties.length > 0) {
          setVarieties(storedVarieties);
        } else {
          setVarieties(VARIETIES);
        }
      } catch (e) {
        console.error("Failed to parse stored varieties:", e);
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

  const handleDownloadData = () => {
    const headers: (keyof Variety)[] = ['name', 'family', 'category', 'grouping', 'commonName', 'rating', 'salesPeriod', 'floweringPeriod', 'flowerColour', 'evergreen'];
    const csvRows = varieties.map(v => 
      headers.map(header => `"${v[header] || ''}"`).join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(',') + '\n'
        + csvRows.join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "varieties_data.csv");
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
            const headerLine = rows.shift()?.trim() || '';
            const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, '') as keyof Variety);
            
            const requiredHeaders: (keyof Variety)[] = ['name', 'family', 'category'];
            if (!requiredHeaders.every(h => headers.includes(h))) {
                throw new Error('CSV headers are missing or incorrect. Required: ' + requiredHeaders.join(', '));
            }

            const newVarieties = rows.map((row, index) => {
                const values = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)!.map(v => v.replace(/"/g, '').trim());
                const varietyData: any = {};
                headers.forEach((header, i) => {
                    varietyData[header] = values[i] || '';
                });

                return varietyData as Variety;
            });
            
            setVarieties(newVarieties);
            toast({ title: 'Import Successful', description: `${newVarieties.length} varieties have been loaded from the CSV file.` });
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

  if (!isClient) {
    return (
       <div className="flex items-center justify-center h-screen">
        <div className="text-2xl">Loading Varieties...</div>
      </div>
    );
  }

  return (
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
            <Button variant="outline" onClick={handleDownloadData}><Download /> Download Data</Button>
            <Button onClick={() => fileInputRef.current?.click()}><Upload /> Upload CSV</Button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
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
                <TableHead>Family</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Grouping</TableHead>
                <TableHead>Common Name</TableHead>
                <TableHead>Flowering Period</TableHead>
                <TableHead>Flower Colour</TableHead>
                <TableHead>Evergreen</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {varieties.map((variety, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{variety.name}</TableCell>
                  <TableCell>{variety.family}</TableCell>
                  <TableCell>{variety.category}</TableCell>
                  <TableCell>{variety.grouping}</TableCell>
                  <TableCell>{variety.commonName}</TableCell>
                  <TableCell>{variety.floweringPeriod}</TableCell>
                  <TableCell>{variety.flowerColour}</TableCell>
                  <TableCell>{variety.evergreen}</TableCell>
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
        <DialogContent className="max-w-2xl">
            <VarietyForm
                onSubmit={handleFormSubmit}
                onCancel={() => setIsFormOpen(false)}
            />
        </DialogContent>
      </Dialog>
    </div>
  );
}
