
"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import * as React from 'react';
import { SalesOrdersPanel } from '@/components/sales/SalesOrdersPanel';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';

export default function SalesLandingPage() {
  return (
    <div className="space-y-6">
       <ModulePageHeader 
            title="Sales"
            description="Create and manage customer sales orders."
            actionsSlot={
                <Button asChild>
                    <Link href="/sales/webshop">Create order</Link>
                </Button>
            }
        />

      <SalesOrdersPanel />
    </div>
  );
}
