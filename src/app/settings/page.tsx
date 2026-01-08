
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Database, Ruler, MapPin, Truck, Users, Receipt, ListChecks, Printer, UserPlus, Building2, User, Container, Package, BookOpen, ClipboardCheck, Boxes, BadgeDollarSign, MapPinned } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/ui/templates';

export default function DataManagementPage() {

  return (
    <PageFrame moduleKey="production">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Settings</h1>
            <p className="text-muted-foreground">
              Configure your organization, manage your account, and keep your data in sync across the nursery.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft />
              Back to Nursery Stock
            </Link>
          </Button>
        </div>

        {/* Organization & Account Settings */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Organization & Account</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 /> Organization Settings</CardTitle>
                <CardDescription>Configure your nursery&apos;s profile, branding, and business details.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/organization">
                    Manage Organization
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User /> My Account</CardTitle>
                <CardDescription>Update your personal profile and security settings.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/account">
                    Manage Account
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus /> Team Members</CardTitle>
                <CardDescription>Invite employees, assign roles (Growers = Pickers), and manage access.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/team">
                    Manage Team
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Data Management */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Data Management</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database /> Plant Varieties</CardTitle>
              <CardDescription>Maintain families, categories, and compliance data. Supports CSV import/export.</CardDescription>
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
              <CardDescription>Capture tunnels, glasshouses, areas, and coverage so forms stay accurate.</CardDescription>
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
              <CardDescription>Track trays, pots, and plug dimensions with quick inline edits.</CardDescription>
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
              <CardDescription>Classify plant, haulage, hardware, and admin suppliers with one source of truth.</CardDescription>
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
              <CardTitle className="flex items-center gap-2"><Users /> Customers</CardTitle>
              <CardDescription>Upload store lists, finance contacts, and pricing tiers in bulk.</CardDescription>
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
              <CardDescription>Coming soon: manage SKUs, aliases, and price lists in one place.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/sales/products">
                  Manage Products
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Truck /> Hauliers</CardTitle>
              <CardDescription>Manage approved logistics partners for dispatch drop-downs.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/hauliers">
                  Manage Hauliers
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Container /> Vehicles</CardTitle>
              <CardDescription>Configure truck dimensions, trolley capacity, and loading layouts.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/settings/vehicles">
                  Manage Vehicles
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package /> Trolley Capacity</CardTitle>
              <CardDescription>Configure shelves per trolley for plant family and pot size combinations.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/settings/trolley-capacity">
                  Configure Capacity
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ListChecks /> Dropdown Manager</CardTitle>
              <CardDescription>Rename, reorder, or hide system dropdowns per organisation.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/settings/dropdowns">
                  Configure Dropdowns
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Printer /> Label Management</CardTitle>
              <CardDescription>Design label templates, configure printers, and view print history.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/settings/labels">
                  Manage Labels
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Boxes /> Materials Catalog</CardTitle>
              <CardDescription>Manage pots, trays, soil, labels, and other nursery materials with stock tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/materials/catalog">
                  Manage Materials
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardCheck /> Task Checklists</CardTitle>
              <CardDescription>Configure prerequisite and postrequisite checklists for production, plant health, and dispatch tasks.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/settings/checklists">
                  Manage Checklists
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeDollarSign /> Price Lists
              </CardTitle>
              <CardDescription>Configure pricing tiers and customer-specific pricing for products.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/sales/price-lists">
                  Manage Price Lists
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPinned /> Nursery Sites
                <Badge variant="secondary" className="ml-auto">Coming Soon</Badge>
              </CardTitle>
              <CardDescription>Group locations by physical site for multi-site nursery operations.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled variant="outline">
                Manage Sites
              </Button>
            </CardContent>
          </Card>

          </div>
        </div>

        {/* Help & Documentation */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Help & Documentation</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookOpen /> App Documentation</CardTitle>
                <CardDescription>Learn how HortiTrack works, understand the product hierarchy, batch management, and more.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/docs">
                    View Documentation
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
