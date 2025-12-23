'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Sprout, Package, Truck, ArrowRight, Database, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/ui/templates';

export default function OverviewDocPage() {
  return (
    <PageFrame moduleKey="production">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">System Overview</h1>
            <p className="text-muted-foreground">
              Understanding how HortiTrack&apos;s modules work together.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/settings/docs">
              <ArrowLeft />
              Back to Documentation
            </Link>
          </Button>
        </div>

        {/* Introduction */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What is HortiTrack?</h2>
          <p className="text-muted-foreground">
            HortiTrack is a complete nursery management system designed to track plants from propagation
            through to customer delivery. It connects your growing operations with sales and dispatch,
            giving you full visibility and traceability across your business.
          </p>
        </section>

        {/* Core Modules */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Core Modules</h2>

          <div className="flex flex-col gap-4">
            {/* Production */}
            <Card className="border-green-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sprout className="h-5 w-5 text-green-600" />
                  Production
                </CardTitle>
                <CardDescription>Growing and managing your plant stock</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-3">The Production module handles everything related to growing plants:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Batches:</strong> Track groups of plants from propagation to sale</li>
                  <li><strong>Varieties:</strong> Manage your plant catalog with families, categories, and compliance data</li>
                  <li><strong>Locations:</strong> Organize tunnels, glasshouses, and growing areas</li>
                  <li><strong>Health Logs:</strong> Record treatments, sprays, and observations</li>
                  <li><strong>Grower Guides:</strong> View complete growing history for any batch</li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90" />
            </div>

            {/* Sales */}
            <Card className="border-blue-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Sales
                </CardTitle>
                <CardDescription>Customers, products, and orders</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-3">The Sales module manages the commercial side of your business:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Customers:</strong> Store contacts, addresses, and pricing tiers</li>
                  <li><strong>Products:</strong> Define sellable items linked to your batches</li>
                  <li><strong>Product Groups:</strong> Organize products and apply shared pricing</li>
                  <li><strong>Price Lists:</strong> Customer-specific pricing and volume discounts</li>
                  <li><strong>Orders:</strong> Create and manage customer orders</li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90" />
            </div>

            {/* Dispatch */}
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-amber-600" />
                  Dispatch
                </CardTitle>
                <CardDescription>Picking, loading, and delivery</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-3">The Dispatch module handles getting plants to customers:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Pick Lists:</strong> Generate lists of what needs to be picked</li>
                  <li><strong>Trolley Loading:</strong> Plan efficient trolley arrangements</li>
                  <li><strong>Vehicle Planning:</strong> Allocate orders to trucks with capacity tracking</li>
                  <li><strong>Delivery Routes:</strong> Optimize delivery sequences</li>
                  <li><strong>Proof of Delivery:</strong> Capture signatures and delivery confirmation</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* How They Connect */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">How Modules Connect</h2>

          <Card className="bg-muted/50">
            <CardContent className="pt-6 space-y-4 text-sm">
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold">Production → Sales</h4>
                <p className="text-muted-foreground">
                  Batches are linked to Products. When a batch is ready for sale, it becomes available stock
                  that can fulfill orders. The link maintains traceability from sale back to production.
                </p>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold">Sales → Dispatch</h4>
                <p className="text-muted-foreground">
                  Orders generate pick requirements. The dispatch module knows which batches to pick from
                  based on product-batch links, and tracks the fulfillment process.
                </p>
              </div>

              <div className="border-l-4 border-amber-500 pl-4">
                <h4 className="font-semibold">Dispatch → Production</h4>
                <p className="text-muted-foreground">
                  Picked quantities reduce batch stock automatically. This keeps your nursery stock view
                  accurate without manual updates.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Master Data */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Master Data
          </h2>
          <p className="text-muted-foreground">
            Settings contains your master data - the reference information used across all modules:
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Plant Reference</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• Plant Varieties (families, categories)</li>
                  <li>• Plant Sizes (pot dimensions)</li>
                  <li>• Nursery Locations</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Business Partners</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• Customers & Stores</li>
                  <li>• Suppliers</li>
                  <li>• Hauliers</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Fleet & Logistics</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• Vehicles & Capacities</li>
                  <li>• Trolley Configuration</li>
                  <li>• Delivery Routes</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">System Configuration</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• Dropdown Options</li>
                  <li>• Label Templates</li>
                  <li>• Organization Settings</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Data Flow Diagram */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Typical Workflow
          </h2>

          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <strong>Receive or propagate plants</strong>
                    <p className="text-muted-foreground">Create batches in Production with variety, size, and quantity</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <strong>Grow and maintain</strong>
                    <p className="text-muted-foreground">Log treatments, move locations, transplant as needed</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">3</span>
                  <div>
                    <strong>Mark ready and link to products</strong>
                    <p className="text-muted-foreground">When batch is ready, link it to sellable products</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">4</span>
                  <div>
                    <strong>Create customer orders</strong>
                    <p className="text-muted-foreground">Orders reference products, which link to available batches</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">5</span>
                  <div>
                    <strong>Pick and load</strong>
                    <p className="text-muted-foreground">Generate pick lists, load trolleys, allocate to vehicles</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">6</span>
                  <div>
                    <strong>Deliver and confirm</strong>
                    <p className="text-muted-foreground">Track delivery, capture POD, complete the cycle</p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        </section>

        {/* Next Steps */}
        <section className="space-y-4 pb-8">
          <h2 className="text-2xl font-semibold">Learn More</h2>
          <div className="flex flex-wrap gap-4">
            <Button asChild variant="outline">
              <Link href="/settings/docs/products">
                <Package className="mr-2 h-4 w-4" />
                Products Setup
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/docs/batches">
                <Sprout className="mr-2 h-4 w-4" />
                Batches & Growing
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
