'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Package, Sprout, Truck, BookOpen, Receipt, Users, MapPin } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/ui/templates/PageFrame';

export default function DocumentationPage() {
  return (
    <PageFrame moduleKey="production">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Help & Documentation</h1>
            <p className="text-muted-foreground">
              Learn how HortiTrack works and understand the logic behind key features.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft />
              Back to Settings
            </Link>
          </Button>
        </div>

        {/* Getting Started */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookOpen /> System Overview</CardTitle>
                <CardDescription>Understand the core concepts and how different modules connect together.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/docs/overview">
                    Read Overview
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sales Module */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Sales Module</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package /> Products Setup</CardTitle>
                <CardDescription>Learn about the Product Group → Product → SKU hierarchy and how to configure products for sales.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/docs/products">
                    Learn About Products
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users /> Customers</CardTitle>
                <CardDescription>Understanding customer management, pricing tiers, and store relationships.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/docs/customers">
                    Learn About Customers
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Receipt /> Orders & Invoicing</CardTitle>
                <CardDescription>How orders flow through the system from creation to dispatch and invoicing.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/docs/orders">
                    Learn About Orders
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Production Module */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Production Module</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sprout /> Batches & Growing</CardTitle>
                <CardDescription>Understanding batch creation, grower guides, and tracking plant progress through production.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/docs/batches">
                    Learn About Batches
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin /> Locations</CardTitle>
                <CardDescription>How to organize your nursery with tunnels, glasshouses, and growing areas.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/docs/locations">
                    Learn About Locations
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dispatch Module */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Dispatch Module</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Truck /> Dispatch & Delivery</CardTitle>
                <CardDescription>Managing pick lists, trolley loading, vehicle allocation, and delivery tracking.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/docs/dispatch">
                    Learn About Dispatch
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
