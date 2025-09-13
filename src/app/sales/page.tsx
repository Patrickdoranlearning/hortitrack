
'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import * as React from 'react';
import { SalesOrdersPanel } from '@/components/sales/SalesOrdersPanel';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { PageFrame } from '@/ui/templates/PageFrame';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function SalesLandingPage() {
  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <div className="space-y-6">
        <ModulePageHeader
          title="Sales Dashboard"
          description="Create and manage customer sales orders and view customer insights."
          actionsSlot={
            <Button asChild>
              <Link href="/sales/orders/new">Create order</Link>
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SalesOrdersPanel />
          </div>
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users />
                  Customer Suggestions
                </CardTitle>
                <CardDescription>
                  Customers to contact or visit based on order history and current availability.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-12">
                  <p>Suggestions coming soon.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
