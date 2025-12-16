'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Sprout, GitBranch, Activity, Calendar, Lightbulb, ArrowDown, Info, Thermometer } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/ui/templates/PageFrame';

export default function BatchesDocPage() {
  return (
    <PageFrame moduleKey="production">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Batches & Growing</h1>
            <p className="text-muted-foreground">
              Understanding batch creation, tracking, and the grower guide system.
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
            Batches are the core unit of production in HortiTrack. Each batch represents a group of plants
            of the same variety and size, tracked from propagation through to sale. The batch system supports
            full traceability including parent-child relationships when plants are transplanted or potted up.
          </p>
        </section>

        {/* Batch Lifecycle */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Batch Lifecycle</h2>
          <p className="text-muted-foreground mb-4">
            A batch moves through several phases from creation to sale:
          </p>

          {/* Visual Lifecycle */}
          <div className="flex flex-col gap-2">
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sprout className="h-4 w-4" />
                  Propagation
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Seeds sown, cuttings taken, or plugs received. This is the origin point of your plants.
              </CardContent>
            </Card>

            <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />

            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Growing
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Plants develop through various stages. Care activities like spacing, trimming, and treatments are logged.
              </CardContent>
            </Card>

            <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />

            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitBranch className="h-4 w-4" />
                  Transplanting (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Plants may be potted up to a larger size, creating a new child batch that inherits the history of its parent.
              </CardContent>
            </Card>

            <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />

            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
                  Ready / Available
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Batch is ready for sale and can be linked to products for order fulfillment.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Batch Properties */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Batch Properties</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Core Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><strong>Batch Number:</strong> Unique identifier (auto-generated or custom)</div>
                <div><strong>Variety:</strong> The plant variety being grown</div>
                <div><strong>Size:</strong> Current pot/tray size</div>
                <div><strong>Quantity:</strong> Number of plants in the batch</div>
                <div><strong>Location:</strong> Where the batch is currently located</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tracking Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><strong>Planted At:</strong> When this batch was started/received</div>
                <div><strong>Ready At:</strong> Expected or actual ready-for-sale date</div>
                <div><strong>Week/Year:</strong> Displayed as &quot;W30/25&quot; for week 30 of 2025</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Parent-Child Relationships */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Batch Lineage
          </h2>
          <p className="text-muted-foreground">
            When plants are transplanted to a larger size, a new batch is created with a link to its parent batch.
            This creates a complete history chain that HortiTrack uses to build the Grower Guide.
          </p>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Example Lineage</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>A Lavender Hidcote plant might have this history:</p>
              <p className="text-sm font-mono mt-2">
                Plug Tray (W20) → 9cm Pot (W24) → 1L Pot (W30) → <strong>2L Pot (Current)</strong>
              </p>
              <p className="text-sm mt-2">Each arrow represents a transplant event where a new batch was created.</p>
            </AlertDescription>
          </Alert>
        </section>

        {/* Grower Guide */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Thermometer className="h-6 w-6" />
            Grower Guide
          </h2>
          <p className="text-muted-foreground">
            The Grower Guide compiles a complete growing history for any batch, including all ancestor batches.
            It&apos;s useful for quality control, compliance, and understanding what happened to your plants.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline View</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Shows all events chronologically:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Propagation start</li>
                  <li>Transplant events</li>
                  <li>Treatments and sprays</li>
                  <li>Care activities (spacing, trimming)</li>
                  <li>Location movements</li>
                  <li>Ready for sale milestone</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stage Summaries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Each growth stage (batch) shows:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Size at that stage</li>
                  <li>Duration (start to end week)</li>
                  <li>Treatments applied</li>
                  <li>Care activities performed</li>
                  <li>Quantity at that stage</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Protocol Integration</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p className="mb-2">
                If a batch has a growing protocol assigned, the Grower Guide includes target conditions:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <div className="bg-muted/50 p-2 rounded">Temperature (Day/Night)</div>
                <div className="bg-muted/50 p-2 rounded">Humidity %</div>
                <div className="bg-muted/50 p-2 rounded">Light Hours</div>
                <div className="bg-muted/50 p-2 rounded">EC / pH Targets</div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Batch Events */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Recording Events</h2>
          <p className="text-muted-foreground">
            Keep your batch records accurate by logging events as they happen:
          </p>

          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-2">Milestones</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Check-in (receiving plants)</li>
                    <li>• Propagation started</li>
                    <li>• Marked ready for sale</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Care Activities</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Spacing out plants</li>
                    <li>• Trimming / Pinching</li>
                    <li>• Uncovering / Grading</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Treatments</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Sprays (product, rate, method)</li>
                    <li>• Fertilizer applications</li>
                    <li>• Health observations</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Movements</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Location changes</li>
                    <li>• Transplanting out</li>
                    <li>• Losses and reasons</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tips */}
        <section className="space-y-4">
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>Tips for Effective Batch Management</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Use consistent batch numbering (e.g., include week/year like &quot;LAV-HID-W30-25&quot;)</li>
                <li>Log treatments promptly for accurate compliance records</li>
                <li>Always create child batches when transplanting to maintain lineage</li>
                <li>Update quantities after losses or picking to keep stock accurate</li>
                <li>Link batches to products when ready for sale to enable order fulfillment</li>
              </ul>
            </AlertDescription>
          </Alert>
        </section>

        {/* Quick Links */}
        <section className="space-y-4 pb-8">
          <h2 className="text-2xl font-semibold">Get Started</h2>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/">
                <Sprout className="mr-2 h-4 w-4" />
                View Nursery Stock
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/production">
                <Activity className="mr-2 h-4 w-4" />
                Production Dashboard
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
