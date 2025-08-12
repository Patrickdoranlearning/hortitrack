
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Database, Boxes, Ruler, MapPin, Truck, PackageSearch } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6">
       <div className="mb-6 flex justify-between items-center">
        <h1 className="font-headline text-4xl">Manage Data</h1>
        <Button asChild variant="outline">
            <Link href="/">
                <ArrowLeft />
                Back to Nursery Stock
            </Link>
        </Button>
      </div>
      <p className="mb-6 text-muted-foreground">
        Manage your "golden tables" - the standardized lists of data used throughout the application.
      </p>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PackageSearch /> Batch Data</CardTitle>
            <CardDescription>View, search, and manage all historical and active batch records in a table.</CardDescription>
          </CardHeader>
          <CardContent>
             <Button asChild>
                <Link href="/batches">
                    Manage Batches
                </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database /> Plant Varieties</CardTitle>
            <CardDescription>View and manage the master list of all plant varieties, including their family and category.</CardDescription>
          </CardHeader>
          <CardContent>
             <Button asChild>
                <Link href="/varieties">
                    Manage Varieties
                </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin /> Nursery Locations</CardTitle>
            <CardDescription>Add or remove nursery locations, and define their area and type.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
                <Link href="/locations">
                    Manage Locations
                </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ruler /> Plant Sizes</CardTitle>
            <CardDescription>Maintain the list of standard container and plug sizes for your stock.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
                <Link href="/sizes">
                    Manage Sizes
                </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Truck /> Suppliers</CardTitle>
            <CardDescription>Maintain the list of plant and material suppliers for your nursery.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
                <Link href="/suppliers">
                    Manage Suppliers
                </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
