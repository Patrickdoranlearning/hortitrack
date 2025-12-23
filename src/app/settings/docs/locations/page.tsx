'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, MapPin, Building2, Grid3X3, Thermometer, Lightbulb, Info } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/ui/templates';

export default function LocationsDocPage() {
  return (
    <PageFrame moduleKey="production">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Nursery Locations</h1>
            <p className="text-muted-foreground">
              Organizing your growing spaces for efficient batch tracking.
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
            Locations in HortiTrack represent the physical spaces where you grow plants.
            Properly configured locations make it easy to track where batches are, generate
            accurate pick lists, and understand space utilization across your nursery.
          </p>
        </section>

        {/* Location Hierarchy */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Location Structure</h2>
          <p className="text-muted-foreground mb-4">
            Locations can be organized hierarchically to match your nursery layout:
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  Site / Area
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Top-level grouping. Could be different nursery sites or major areas.
                <p className="text-xs italic mt-2">e.g., &quot;Main Site&quot;, &quot;North Field&quot;</p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Thermometer className="h-4 w-4" />
                  Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Tunnels, glasshouses, polytunnels, or outdoor beds.
                <p className="text-xs italic mt-2">e.g., &quot;Tunnel 1&quot;, &quot;Glasshouse A&quot;</p>
              </CardContent>
            </Card>

            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Grid3X3 className="h-4 w-4" />
                  Bay / Section
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Specific areas within a structure for precise positioning.
                <p className="text-xs italic mt-2">e.g., &quot;Bay 1&quot;, &quot;Left Side&quot;, &quot;Bench 3&quot;</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Location Properties */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Location Properties
          </h2>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Core Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><strong>Name:</strong> How the location is referred to</div>
              <div><strong>Code:</strong> Short code for labels and pick lists</div>
              <div><strong>Type:</strong> Tunnel, glasshouse, outdoor, coldstore, etc.</div>
              <div><strong>Parent Location:</strong> Where this location sits in the hierarchy</div>
              <div><strong>Active:</strong> Whether the location is currently in use</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Optional Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div><strong>Capacity:</strong> How many plants/trays can fit</div>
              <div><strong>Coverage:</strong> Square meters or bench space</div>
              <div><strong>Climate Zone:</strong> Heated, unheated, frost-free, etc.</div>
              <div><strong>Notes:</strong> Any special characteristics</div>
            </CardContent>
          </Card>
        </section>

        {/* How Locations are Used */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">How Locations are Used</h2>

          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Batch Tracking</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Every batch has a current location. When you move batches, the system logs
                the movement event and updates the location. This gives you a complete history
                of where each batch has been.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pick Lists</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Pick lists group items by location so pickers can work efficiently through
                the nursery. Well-organized locations mean faster, more accurate picking.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Stock View</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                The nursery stock view can be filtered by location, letting you see what&apos;s
                in a specific tunnel or area. Useful for planning moves and checking space.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Grower Guide</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Location movements are recorded in the batch&apos;s grower guide timeline,
                showing where plants were at each stage of growth.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Best Practices */}
        <section className="space-y-4">
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>Best Practices</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Use short, memorable codes (e.g., T1, T2, GH-A) for quick reference</li>
                <li>Match your physical signage to location names in the system</li>
                <li>Set up the hierarchy before creating batches to avoid rework</li>
                <li>Mark locations as inactive rather than deleting them to preserve history</li>
                <li>Consider creating &quot;virtual&quot; locations for dispatch staging areas</li>
              </ul>
            </AlertDescription>
          </Alert>
        </section>

        {/* Example Setup */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Example Setup</h2>

          <Card className="bg-muted/50">
            <CardContent className="pt-6 text-sm">
              <p className="font-medium mb-4">A typical nursery might have:</p>
              <div className="font-mono text-xs space-y-1">
                <div>Main Site</div>
                <div className="pl-4">├── Propagation House</div>
                <div className="pl-8">├── Bench 1</div>
                <div className="pl-8">├── Bench 2</div>
                <div className="pl-8">└── Mist Unit</div>
                <div className="pl-4">├── Tunnel 1 (Heated)</div>
                <div className="pl-8">├── Bay A</div>
                <div className="pl-8">├── Bay B</div>
                <div className="pl-8">└── Bay C</div>
                <div className="pl-4">├── Tunnel 2 (Unheated)</div>
                <div className="pl-4">├── Glasshouse</div>
                <div className="pl-4">├── Outdoor Standing</div>
                <div className="pl-4">└── Dispatch Area</div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick Links */}
        <section className="space-y-4 pb-8">
          <h2 className="text-2xl font-semibold">Get Started</h2>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/locations">
                <MapPin className="mr-2 h-4 w-4" />
                Manage Locations
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
