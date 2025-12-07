import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import SalesOrdersClient from './SalesOrdersClient';

export default async function SalesOrdersPage() {
    const supabase = await createClient();

    const { data: orders } = await supabase
        .from('orders')
        .select(`
            *,
            customer:customers(name)
        `)
        .order('created_at', { ascending: false });

    return (
        <PageFrame companyName="Doran Nurseries" moduleKey="sales">
            <div className="space-y-6">
                <ModulePageHeader
                    title="Sales Orders"
                    description="Manage customer orders"
                    actionsSlot={
                        <Button asChild>
                            <Link href="/sales/orders/new">Create Order</Link>
                        </Button>
                    }
                />

                <SalesOrdersClient initialOrders={orders || []} />
            </div>
        </PageFrame>
    );
}
