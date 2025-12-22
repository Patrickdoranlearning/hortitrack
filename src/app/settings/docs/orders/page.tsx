'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Receipt, ClipboardList, Truck, FileText, ArrowDown, CheckCircle, Lightbulb, Info } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/ui/templates/PageFrame';

export default function OrdersDocPage() {
  return (
    <PageFrame moduleKey="production">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Orders & Invoicing</h1>
            <p className="text-muted-foreground">
              Understanding the order lifecycle from creation to invoicing.
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
            Orders in HortiTrack flow through a defined lifecycle from creation through to dispatch
            and invoicing. The system tracks what was ordered, what was picked, and what was delivered,
            ensuring accurate billing and traceability.
          </p>
        </section>

        {/* Order Lifecycle */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Order Lifecycle</h2>

          <div className="flex flex-col gap-2">
            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4" />
                  Draft / New
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Order created with customer, delivery date, and line items. Can still be edited.
              </CardContent>
            </Card>

            <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />

            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4" />
                  Confirmed
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Order confirmed and scheduled for fulfillment. Appears on pick lists.
              </CardContent>
            </Card>

            <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />

            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4" />
                  Dispatched
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Order picked, loaded, and sent for delivery. Actual quantities captured.
              </CardContent>
            </Card>

            <ArrowDown className="h-5 w-5 text-muted-foreground mx-auto" />

            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="h-4 w-4" />
                  Delivered / Completed
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Delivery confirmed with proof of delivery. Ready for invoicing.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Order Components */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Order Components</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Header</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><strong>Customer:</strong> Who is ordering</div>
                <div><strong>Delivery Address:</strong> Which store/location</div>
                <div><strong>Order Date:</strong> When the order was placed</div>
                <div><strong>Delivery Date:</strong> Requested delivery date</div>
                <div><strong>PO Number:</strong> Customer&apos;s purchase order reference</div>
                <div><strong>Notes:</strong> Special instructions</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Lines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><strong>Product:</strong> What&apos;s being ordered</div>
                <div><strong>Quantity Ordered:</strong> How many requested</div>
                <div><strong>Quantity Picked:</strong> How many actually picked</div>
                <div><strong>Unit Price:</strong> From price list or alias</div>
                <div><strong>Line Total:</strong> Quantity × Price</div>
                <div><strong>VAT Rate:</strong> Tax rate applied</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Product Groups in Orders */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Ordering by Product Group</h2>
          <p className="text-muted-foreground">
            When customers order by Product Group (e.g., &quot;Mixed Herbs&quot;), you can fulfill
            with any products in that group. This is useful for category-based ordering.
          </p>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Order Item Preferences</AlertTitle>
            <AlertDescription>
              When fulfilling a group order, you can specify preferences:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Which specific products to include from the group</li>
                <li>Preferred varieties if multiple are available</li>
                <li>How to split quantities across products</li>
              </ul>
            </AlertDescription>
          </Alert>
        </section>

        {/* Fulfillment */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Fulfillment Process</h2>

          <Card className="bg-muted/50">
            <CardContent className="pt-6 space-y-4 text-sm">
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold">1. Pick List Generation</h4>
                <p className="text-muted-foreground">
                  Orders for a delivery date generate a pick list showing what needs to be collected
                  from which batches and locations.
                </p>
              </div>

              <div className="border-l-4 border-amber-500 pl-4">
                <h4 className="font-semibold">2. Picking</h4>
                <p className="text-muted-foreground">
                  Pickers collect plants, recording actual quantities. If stock is short,
                  the system captures the difference.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold">3. Loading</h4>
                <p className="text-muted-foreground">
                  Picked items are loaded onto trolleys and vehicles. The dispatch module
                  tracks what&apos;s on each vehicle.
                </p>
              </div>

              <div className="border-l-4 border-primary pl-4">
                <h4 className="font-semibold">4. Delivery Confirmation</h4>
                <p className="text-muted-foreground">
                  Driver confirms delivery with signature/photo. Any rejections or shorts
                  are captured for accurate invoicing.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Invoicing */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Invoicing
          </h2>
          <p className="text-muted-foreground">
            Invoices are generated from delivered orders, using the actual delivered quantities
            rather than originally ordered quantities.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Invoice Contains</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="list-disc list-inside space-y-1">
                  <li>Customer billing details</li>
                  <li>Order/delivery reference</li>
                  <li>Line items with delivered quantities</li>
                  <li>Unit prices and line totals</li>
                  <li>VAT breakdown</li>
                  <li>Payment terms and due date</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pricing on Invoice</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Uses customer&apos;s pricing from:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Product alias (if set for this customer)</li>
                  <li>Customer&apos;s price list</li>
                  <li>Customer&apos;s product codes/names shown</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Tips */}
        <section className="space-y-4">
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>Tips</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Confirm orders early to give pickers adequate time</li>
                <li>Use customer PO numbers to make their invoice reconciliation easier</li>
                <li>Record actual picked quantities to ensure invoice accuracy</li>
                <li>Capture delivery confirmations before generating invoices</li>
                <li>Review shorts and rejections to understand fulfillment issues</li>
              </ul>
            </AlertDescription>
          </Alert>
        </section>

        {/* Quick Links */}
        <section className="space-y-4 pb-8">
          <h2 className="text-2xl font-semibold">Get Started</h2>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/sales/orders">
                <Receipt className="mr-2 h-4 w-4" />
                View Orders
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
