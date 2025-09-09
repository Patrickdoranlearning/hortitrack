
"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import * as React from 'react';
import { SalesOrdersPanel } from '@/components/sales/SalesOrdersPanel';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { PageFrame } from '@/ui/templates/PageFrame';

const TABS = [
    { label: "Production", href: "/production" },
    { 
        label: "Sales", 
        href: "/sales", 
        items: [
            { label: "Sales Dashboard", href: "/sales"},
            { label: "Orders", href: "/sales/orders"},
            { label: "Customers", href: "/sales/customers"},
            { label: "Products", href: "/sales/products"},
        ]
    },
    { label: "Plant Health", href: "/actions" },
    { label: "Dispatch", href: "/dispatch" },
];

export default function SalesLandingPage() {
  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales" moduleTabs={TABS}>
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
    </PageFrame>
  );
}
