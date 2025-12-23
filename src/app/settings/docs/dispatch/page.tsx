'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Truck, ClipboardList, Package, MapPin, CheckCircle, ArrowDown, Lightbulb, Info } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/ui/templates';

export default function DispatchDocPage() {
  return (
    <PageFrame moduleKey="production">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Dispatch & Delivery</h1>
            <p className="text-muted-foreground">
              Managing the picking, loading, and delivery process.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/settings/docs">
              <ArrowLeft />
              Back to Documentation
            </Link>
          </Button>
        </div>

        {/* Overview */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Overview</h2>
          <p className="text-muted-foreground">
            The Dispatch module handles everything from generating pick lists through to
            confirming deliveries. It connects orders to physical operations, ensuring
            the right plants get to the right customers efficiently.
          </p>
        </section>

        {/* Dispatch Workflow */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Dispatch Workflow</h2>

          <div className="flex flex-col gap-2">
            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4" />
                  1. Generate Pick Lists
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Select orders for a delivery date. The system generates pick lists organized
                by location for efficient collection.
              </CardContent>
            </Card>

            <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />

            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  2. Pick & Record
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Pickers collect plants from their locations, recording actual quantities.
                Any shorts or substitutions are captured.
              </CardContent>
            </Card>

            <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />

            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4" />
                  3. Load Vehicles
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Picked items are loaded onto trolleys and into vehicles. The system tracks
                capacity and helps optimize loading.
              </CardContent>
            </Card>

            <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />

            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="h-4 w-4" />
                  4. Deliver & Confirm
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Drivers deliver to customers and capture proof of delivery. Any issues
                (rejections, returns) are recorded.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Pick Lists */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Pick Lists
          </h2>
          <p className="text-muted-foreground">
            Pick lists tell your team what to collect and where to find it. They&apos;re
            organized to minimize walking time and errors.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pick List Shows</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><strong>Product:</strong> What needs to be picked</div>
                <div><strong>Quantity:</strong> How many to collect</div>
                <div><strong>Location:</strong> Where to find it</div>
                <div><strong>Batch:</strong> Which batch to pick from</div>
                <div><strong>Customer:</strong> Who it&apos;s for (for labeling)</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pick List Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>• Group by location for efficient routing</div>
                <div>• Group by customer for order assembly</div>
                <div>• Group by product for bulk picking</div>
                <div>• Print labels during picking</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Trolleys & Loading */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Trolley Loading
          </h2>
          <p className="text-muted-foreground">
            Plants are loaded onto trolleys for transport. HortiTrack helps calculate
            how many shelves are needed based on plant size and pot dimensions.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trolley Capacity Configuration</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p className="mb-3">
                The system calculates trolley requirements based on configured capacities.
                You can set different shelf counts for different plant families and sizes:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Global default:</strong> Standard shelves for most plants</li>
                <li><strong>Size-specific:</strong> e.g., 2L pots need fewer shelves</li>
                <li><strong>Family-specific:</strong> e.g., tall grasses need more headroom</li>
                <li><strong>Exact match:</strong> Specific family + size combinations</li>
              </ul>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Capacity Priority</AlertTitle>
            <AlertDescription>
              When calculating shelves, the system uses the most specific match:
              Exact Match &gt; Family Default &gt; Size Default &gt; Global Default
            </AlertDescription>
          </Alert>
        </section>

        {/* Vehicles */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Vehicle Management
          </h2>
          <p className="text-muted-foreground">
            Configure your delivery vehicles with their capacities to help plan efficient
            delivery runs.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vehicle Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><strong>Name/Registration:</strong> Vehicle identification</div>
              <div><strong>Type:</strong> Van, truck, trailer, etc.</div>
              <div><strong>Trolley Capacity:</strong> How many trolleys fit</div>
              <div><strong>Layout:</strong> Rows and columns for visual planning</div>
              <div><strong>Haulier:</strong> If using third-party logistics</div>
            </CardContent>
          </Card>
        </section>

        {/* Delivery Routes */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Delivery Planning
          </h2>

          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Route Assignment</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Assign orders to delivery routes based on geography. Customers can have
                a default route, or be assigned per-order for flexibility.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Vehicle Allocation</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Assign vehicles to routes based on total trolley requirements. The system
                shows capacity utilization to help balance loads.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Delivery Sequence</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Set the order of stops on a route. Consider loading in reverse delivery
                order so the first delivery is at the back of the truck.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Proof of Delivery */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <CheckCircle className="h-6 w-6" />
            Proof of Delivery
          </h2>
          <p className="text-muted-foreground">
            Capture delivery confirmation to complete the dispatch cycle and enable accurate invoicing.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">POD Captures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>• Signature from customer</div>
              <div>• Photo of delivery</div>
              <div>• Any rejections or issues</div>
              <div>• Delivery timestamp and location</div>
              <div>• Notes from driver</div>
            </CardContent>
          </Card>
        </section>

        {/* Tips */}
        <section className="space-y-4">
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>Tips for Efficient Dispatch</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Generate pick lists the day before for early morning picking</li>
                <li>Use location-based pick lists for large orders</li>
                <li>Label plants as you pick to avoid mistakes during loading</li>
                <li>Check trolley capacity configs match your actual trolley types</li>
                <li>Load vehicles in reverse delivery order</li>
                <li>Capture POD immediately to speed up invoicing</li>
              </ul>
            </AlertDescription>
          </Alert>
        </section>

        {/* Quick Links */}
        <section className="space-y-4 pb-8">
          <h2 className="text-2xl font-semibold">Get Started</h2>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/dispatch">
                <Truck className="mr-2 h-4 w-4" />
                Open Dispatch
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/vehicles">
                <Truck className="mr-2 h-4 w-4" />
                Manage Vehicles
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/trolley-capacity">
                <Package className="mr-2 h-4 w-4" />
                Configure Trolley Capacity
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
