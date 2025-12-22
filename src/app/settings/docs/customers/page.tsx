'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Users, Building, MapPin, CreditCard, Tag, Lightbulb, Info } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/ui/templates/PageFrame';

export default function CustomersDocPage() {
  return (
    <PageFrame moduleKey="production">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Customers</h1>
            <p className="text-muted-foreground">
              Managing customer accounts, stores, and pricing relationships.
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
            Customers in HortiTrack represent the businesses you sell to. Each customer can have
            multiple delivery addresses (stores), custom pricing through price lists, and
            product-specific aliases for their internal codes and names.
          </p>
        </section>

        {/* Customer Structure */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Customer Structure
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Customer Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><strong>Name:</strong> The trading name of the business</div>
                <div><strong>Account Code:</strong> Your internal customer reference</div>
                <div><strong>Contact Details:</strong> Primary contact, email, phone</div>
                <div><strong>Finance Contact:</strong> For invoicing queries</div>
                <div><strong>Default Price List:</strong> Which pricing tier they use</div>
                <div><strong>Payment Terms:</strong> e.g., 30 days, prepay</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Stores / Delivery Addresses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Each customer can have multiple stores:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Store name and code</li>
                  <li>Full delivery address</li>
                  <li>Delivery instructions</li>
                  <li>Opening hours / delivery windows</li>
                  <li>Contact at that location</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Price Lists */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Price Lists
          </h2>
          <p className="text-muted-foreground">
            Price Lists allow you to maintain different pricing for different customers or customer groups.
            This is useful when you have trade, retail, or volume-based pricing tiers.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How Price Lists Work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="font-semibold text-primary">1.</span>
                <span><strong>Create Price Lists</strong> - e.g., &quot;Standard Trade&quot;, &quot;Premium&quot;, &quot;Volume Discount&quot;</span>
              </div>
              <div className="flex gap-3">
                <span className="font-semibold text-primary">2.</span>
                <span><strong>Assign Products</strong> - Add products with their prices for each list</span>
              </div>
              <div className="flex gap-3">
                <span className="font-semibold text-primary">3.</span>
                <span><strong>Link to Customers</strong> - Set each customer&apos;s default price list</span>
              </div>
              <div className="flex gap-3">
                <span className="font-semibold text-primary">4.</span>
                <span><strong>Orders Use Correct Prices</strong> - When ordering, the customer sees their pricing</span>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Price List Priority</AlertTitle>
            <AlertDescription>
              When determining a price for an order, HortiTrack checks in order:
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Product Alias price (customer-specific override)</li>
                <li>Customer&apos;s assigned Price List</li>
                <li>Default Price List (if no customer price list)</li>
              </ol>
            </AlertDescription>
          </Alert>
        </section>

        {/* Customer Aliases */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Tag className="h-6 w-6" />
            Customer-Specific Product Info
          </h2>
          <p className="text-muted-foreground">
            Large retailers often have their own product codes, barcodes, and names for the plants you supply.
            Product Aliases let you store this information so orders and documents show their codes.
          </p>

          <Card className="bg-muted/50">
            <CardContent className="pt-6 space-y-4 text-sm">
              <p className="font-medium">Example: Selling to a garden centre chain</p>
              <div className="space-y-2">
                <div className="border-l-2 border-primary pl-4">
                  <p><strong>Your Product:</strong> Lavender Hidcote 9cm</p>
                  <p className="text-muted-foreground">Internal SKU: LAV-HID-9</p>
                </div>
                <div className="border-l-2 border-blue-500 pl-4">
                  <p><strong>Their Alias:</strong></p>
                  <p className="text-muted-foreground">
                    Name: &quot;Lavender angustifolia Hidcote&quot;<br/>
                    Code: &quot;501438&quot;<br/>
                    Barcode: &quot;5014388501438&quot;<br/>
                    Price: £2.45
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground pt-2">
                When this customer places an order, their documents show their codes and pricing.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Common Workflows */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Common Workflows</h2>

          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Adding a New Customer</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create the customer account with their details</li>
                  <li>Add their stores/delivery addresses</li>
                  <li>Assign a price list (or create a new one if needed)</li>
                  <li>Set up product aliases if they use their own codes</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Bulk Import</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>For large customer lists with many stores, you can import via CSV:</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Customer details with store addresses</li>
                  <li>Product aliases and pricing</li>
                  <li>Price list assignments</li>
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
                <li>Use consistent account codes (e.g., customer initials + number)</li>
                <li>Keep store codes short for easy reference on pick lists</li>
                <li>Set up product aliases before the first order to avoid manual corrections</li>
                <li>Review price lists regularly to ensure they&apos;re up to date</li>
              </ul>
            </AlertDescription>
          </Alert>
        </section>

        {/* Quick Links */}
        <section className="space-y-4 pb-8">
          <h2 className="text-2xl font-semibold">Get Started</h2>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/sales/customers">
                <Users className="mr-2 h-4 w-4" />
                Manage Customers
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
