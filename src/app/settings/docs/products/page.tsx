'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Package, Layers, Tag, Users, Lightbulb, ArrowRight, Info } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/ui/templates/PageFrame';

export default function ProductsDocPage() {
  return (
    <PageFrame moduleKey="production">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Products Setup</h1>
            <p className="text-muted-foreground">
              Understanding the product hierarchy and how to configure products for sales.
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
            HortiTrack uses a flexible product structure that separates what you sell (Products) from what you grow (Batches/Varieties).
            This allows you to sell the same physical plants under different names, prices, and SKUs for different customers.
          </p>
        </section>

        {/* The Hierarchy */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">The Product Hierarchy</h2>
          <p className="text-muted-foreground mb-4">
            Products are organized in a three-level hierarchy that gives you maximum flexibility:
          </p>

          {/* Visual Hierarchy */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            <Card className="flex-1 border-primary/50 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers className="h-5 w-5" />
                  Product Groups
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">The top level for organizing related products together.</p>
                <p className="text-xs italic">Example: &quot;Lavender Range&quot;, &quot;Herbs Collection&quot;</p>
              </CardContent>
            </Card>

            <ArrowRight className="hidden md:block h-6 w-6 text-muted-foreground self-center" />

            <Card className="flex-1 border-blue-500/50 bg-blue-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5" />
                  Products
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Individual sellable items linked to plant varieties.</p>
                <p className="text-xs italic">Example: &quot;Lavender Hidcote 9cm&quot;, &quot;Mixed Herbs Tray&quot;</p>
              </CardContent>
            </Card>

            <ArrowRight className="hidden md:block h-6 w-6 text-muted-foreground self-center" />

            <Card className="flex-1 border-green-500/50 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tag className="h-5 w-5" />
                  SKUs & Aliases
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Customer-specific codes, names, and pricing.</p>
                <p className="text-xs italic">Example: &quot;LAV-HID-9&quot; for B&amp;Q, &quot;12345&quot; for Homebase</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Product Groups */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Product Groups
          </h2>
          <p className="text-muted-foreground">
            Product Groups let you organize products and apply shared aliases/pricing to multiple products at once.
            This is especially useful when customers order by category rather than specific variety.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">When to Use Product Groups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="font-semibold text-primary">✓</span>
                <span>A customer orders &quot;Mixed Herbs&quot; and you fulfill with whatever herb varieties are available</span>
              </div>
              <div className="flex gap-3">
                <span className="font-semibold text-primary">✓</span>
                <span>You want to apply the same customer alias/pricing to all lavenders regardless of variety</span>
              </div>
              <div className="flex gap-3">
                <span className="font-semibold text-primary">✓</span>
                <span>Customers use category codes (like &quot;HERB-MIX&quot;) instead of individual product codes</span>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Rule-Based Membership</AlertTitle>
            <AlertDescription>
              Product Groups can automatically include products based on rules (e.g., all products in the &quot;Herbs&quot; category).
              You can also manually include or exclude specific products.
            </AlertDescription>
          </Alert>
        </section>

        {/* Products */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Products
          </h2>
          <p className="text-muted-foreground">
            Products are the core sellable items. Each product is linked to a SKU (Stock Keeping Unit)
            which defines its internal code and connects it to plant varieties and sizes.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><strong>Name:</strong> The internal product name you&apos;ll see in HortiTrack</div>
                <div><strong>SKU:</strong> Links to a specific variety + size combination</div>
                <div><strong>Description:</strong> Optional details about the product</div>
                <div><strong>Hero Image:</strong> Product image for sales materials</div>
                <div><strong>Status:</strong> Active or inactive for sales</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Batch Linking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Products can be linked to production batches to track:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Available stock for each product</li>
                  <li>Which batches fulfill which orders</li>
                  <li>Traceability from sale back to production</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Aliases */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Customer Aliases
          </h2>
          <p className="text-muted-foreground">
            Aliases allow you to set up customer-specific product names, codes, and pricing.
            When that customer places an order, they&apos;ll see their familiar codes and names.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alias Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><strong>Alias Name:</strong> What the customer calls this product</div>
              <div><strong>Customer SKU Code:</strong> The customer&apos;s internal product code</div>
              <div><strong>Customer Barcode:</strong> The barcode they scan at their end</div>
              <div><strong>Unit Price:</strong> Special pricing for this customer (overrides price list)</div>
              <div><strong>RRP:</strong> Recommended retail price (what they charge their customers)</div>
              <div><strong>Price List:</strong> Link to a specific price list for tiered pricing</div>
            </CardContent>
          </Card>

          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>Tip: Group vs Product Aliases</AlertTitle>
            <AlertDescription>
              Aliases can be set at both the Product Group level and the individual Product level.
              Product-level aliases override Group-level aliases, giving you flexibility to handle exceptions.
            </AlertDescription>
          </Alert>
        </section>

        {/* Example Workflow */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Example Setup</h2>
          <Card className="bg-muted/50">
            <CardContent className="pt-6 space-y-4 text-sm">
              <p className="font-medium">Scenario: You grow Lavender Hidcote and sell to both B&amp;Q and an independent garden centre.</p>

              <div className="space-y-3">
                <div className="border-l-2 border-primary pl-4">
                  <p className="font-semibold">1. Create a Product Group: &quot;Lavender Range&quot;</p>
                  <p className="text-muted-foreground">Set rule: Category = &quot;Lavender&quot; to auto-include all lavender products</p>
                </div>

                <div className="border-l-2 border-blue-500 pl-4">
                  <p className="font-semibold">2. Create Product: &quot;Lavender Hidcote 9cm&quot;</p>
                  <p className="text-muted-foreground">Link to SKU for Lavender Hidcote variety + 9cm pot size</p>
                </div>

                <div className="border-l-2 border-green-500 pl-4">
                  <p className="font-semibold">3. Add Aliases</p>
                  <p className="text-muted-foreground">
                    B&amp;Q Alias: Name=&quot;Lavender angustifolia Hidcote&quot;, Code=&quot;5014388&quot;, Price=£2.50<br/>
                    Garden Centre Alias: Name=&quot;Hidcote Lavender&quot;, Code=&quot;LAV-H-9&quot;, Price=£1.80
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground pt-2">
                Now when B&amp;Q places an order, they see their product code and name, while the garden centre sees theirs - but internally you&apos;re managing the same product!
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Quick Links */}
        <section className="space-y-4 pb-8">
          <h2 className="text-2xl font-semibold">Get Started</h2>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/sales/products">
                <Package className="mr-2 h-4 w-4" />
                Manage Products
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sales/products/groups">
                <Layers className="mr-2 h-4 w-4" />
                Manage Product Groups
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
