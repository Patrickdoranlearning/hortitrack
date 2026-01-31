'use client';

import Link from 'next/link';
import { Package, PackagePlus, BarChart3, ShoppingCart, AlertTriangle, Boxes, ScanLine } from 'lucide-react';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MaterialsPage() {
  return (
    <PageFrame moduleKey="materials">
      <div className="space-y-6">
        <ModulePageHeader
          title="Materials"
          description="Manage materials inventory, purchase orders, and stock levels."
        />

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Active items in catalog</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">-</div>
              <p className="text-xs text-muted-foreground">Items below reorder point</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open POs</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Awaiting delivery</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Total inventory value</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Materials Catalog
              </CardTitle>
              <CardDescription>
                Manage your materials catalog - pots, trays, soil, labels, chemicals, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/materials/catalog">View Catalog</Link>
                </Button>
                <Button asChild>
                  <Link href="/materials/catalog?new=true">
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Add Material
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Stock Levels
              </CardTitle>
              <CardDescription>
                View current stock levels, make adjustments, and transfer materials between locations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/materials/stock">View Stock</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Purchase Orders
              </CardTitle>
              <CardDescription>
                Create purchase orders for suppliers and receive incoming materials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/materials/purchase-orders">View POs</Link>
                </Button>
                <Button asChild>
                  <Link href="/materials/purchase-orders/new">
                    <PackagePlus className="mr-2 h-4 w-4" />
                    New PO
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5" />
                Material Lots
              </CardTitle>
              <CardDescription>
                Track individual boxes, bags, and pallets with scannable barcodes for full traceability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/materials/lots">View Lots</Link>
                </Button>
                <Button asChild>
                  <Link href="/materials/receive">
                    <ScanLine className="mr-2 h-4 w-4" />
                    Receive Materials
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alerts Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>
              Materials that have fallen below their reorder point.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No low stock alerts.</p>
              <p className="text-sm">Materials will appear here when stock falls below reorder point.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}
