
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import * as React from 'react';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { PageFrame } from '@/ui/templates/PageFrame';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import SalesMetrics, { DashboardMetrics } from '@/components/sales/SalesMetrics';
import { createClient } from '@/lib/supabase/server';
import { startOfWeek, endOfWeek, addWeeks, formatISO } from 'date-fns';

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

                <SalesMetrics metrics={metrics} />

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold tracking-tight">Quick Actions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Link href="/sales/orders">
                            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                                <CardHeader>
                                    <CardTitle>Orders</CardTitle>
                                    <CardDescription>Manage customer orders</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">View All</p>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/sales/picking">
                            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                                <CardHeader>
                                    <CardTitle>Picking</CardTitle>
                                    <CardDescription>View pick lists and status</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">View Picks</p>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/sales/invoices">
                            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                                <CardHeader>
                                    <CardTitle>Invoices</CardTitle>
                                    <CardDescription>Manage invoices and credits</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">View Invoices</p>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>
                </div>
            </div>
        </PageFrame>
    );
}

