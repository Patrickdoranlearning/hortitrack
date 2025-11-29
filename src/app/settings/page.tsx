
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Database, Ruler, MapPin, Truck, PackageSearch, ShoppingCart, Users, Receipt } from 'lucide-react';
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
              Manage your "golden tables"—the standardized datasets that power every production workflow.
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
              <CardTitle className="flex items-center gap-2"><PackageSearch /> Batch Data</CardTitle>
              <CardDescription>View, search, and manage all historical and active batch records in a table.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/production/batches">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShoppingCart /> Sales Orders</CardTitle>
              <CardDescription>View all customer sales orders.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/sales/orders">
                  Manage Orders
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users /> Customers</CardTitle>
              <CardDescription>Manage customer accounts and stores.</CardDescription>
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
              <CardDescription>Manage the sales product catalog.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/sales/products">
                  Manage Products
                </Link>
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </PageFrame>
  );
}
