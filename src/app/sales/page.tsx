
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import * as React from 'react';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { PageFrame } from '@/ui/templates/PageFrame';
import SalesMetrics, { DashboardMetrics } from '@/components/sales/SalesMetrics';
import { createClient } from '@/lib/supabase/server';
import { startOfWeek, endOfWeek, addWeeks, formatISO } from 'date-fns';
import { ClipboardList, ShoppingBag, FileText } from 'lucide-react';

export default async function SalesLandingPage() {
    const supabase = await createClient();
    const now = new Date();

    // Current Week Range
    const startCurrent = startOfWeek(now, { weekStartsOn: 1 });
    const endCurrent = endOfWeek(now, { weekStartsOn: 1 });

    // Next Week Range
    const startNext = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const endNext = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });

    // Fetch Current Week Orders
    const { data: currentOrders } = await supabase
        .from('orders')
        .select('total_inc_vat')
        .gte('created_at', formatISO(startCurrent))
        .lte('created_at', formatISO(endCurrent));

    // Fetch Next Week Orders (based on requested_delivery_date usually, but using created_at for now as proxy or we can check delivery date)
    // Let's use requested_delivery_date for "Next Week Orders" as that makes more sense for planning
    const { data: nextOrders } = await supabase
        .from('orders')
        .select('total_inc_vat')
        .gte('requested_delivery_date', formatISO(startNext))
        .lte('requested_delivery_date', formatISO(endNext));

    const currentWeekRevenue = currentOrders?.reduce((sum, order) => sum + (order.total_inc_vat || 0), 0) || 0;
    const nextWeekRevenue = nextOrders?.reduce((sum, order) => sum + (order.total_inc_vat || 0), 0) || 0;

    const metrics: DashboardMetrics = {
        currentWeekOrders: currentOrders?.length || 0,
        currentWeekRevenue,
        nextWeekOrders: nextOrders?.length || 0,
        nextWeekRevenue,
        targetAreas: [
            { area: 'Dublin South', potential: 'High' }, // Placeholder for now until we have customer address data analysis
            { area: 'Wicklow', potential: 'Medium' },
        ]
    };

    return (
        <PageFrame companyName="Doran Nurseries" moduleKey="sales">
            <div className="space-y-8">
                <ModulePageHeader
                    title="Sales"
                    description="Create and manage customer sales orders."
                    actionsSlot={
                        <Button asChild>
                            <Link href="/sales/orders/new">Create order</Link>
                        </Button>
                    }
                />

                <div className="flex flex-wrap items-center gap-3">
                    <Button asChild variant="secondary" size="sm" className="gap-2">
                        <Link href="/sales/orders">
                            <ShoppingBag className="h-4 w-4" />
                            Orders
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-2">
                        <Link href="/sales/picking">
                            <ClipboardList className="h-4 w-4" />
                            Picking
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-2">
                        <Link href="/sales/invoices">
                            <FileText className="h-4 w-4" />
                            Invoices
                        </Link>
                    </Button>
                </div>

                <SalesMetrics metrics={metrics} />
            </div>
        </PageFrame>
    );
}

