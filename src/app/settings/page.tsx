
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Database, Ruler, MapPin, Truck, Users, Receipt } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/ui/templates/PageFrame';

export default function DataManagementPage() {

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Data Management</h1>
            <p className="text-muted-foreground">
              Download a template, upload CSVs, or add quick rows to keep your golden data sets in sync across the nursery.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft />
              Back to Nursery Stock
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database /> Plant Varieties</CardTitle>
              <CardDescription>Maintain families, categories, and compliance data. Supports CSV import/export.</CardDescription>
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
              <CardDescription>Capture tunnels, glasshouses, areas, and coverage so forms stay accurate.</CardDescription>
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
              <CardDescription>Track trays, pots, and plug dimensions with quick inline edits.</CardDescription>
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
              <CardDescription>Classify plant, haulage, hardware, and admin suppliers with one source of truth.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/suppliers">
                  Manage Suppliers
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users /> Customers</CardTitle>
              <CardDescription>Upload store lists, finance contacts, and pricing tiers in bulk.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/sales/customers">
                  Manage Customers
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Receipt /> Products</CardTitle>
              <CardDescription>Coming soon: manage SKUs, aliases, and price lists in one place.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/sales/products">
                  Manage Products
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Truck /> Hauliers</CardTitle>
              <CardDescription>Manage approved logistics partners for dispatch drop-downs.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/hauliers">
                  Manage Hauliers
                </Link>
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </PageFrame>
  );
}
