import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import SalesOrdersClient from './SalesOrdersClient';
import { listOrders } from '@/server/sales/queries.server';

export default async function SalesOrdersPage({
    searchParams,
}: {
    searchParams?: { page?: string; status?: string; pageSize?: string };
}) {
    const page = Number(searchParams?.page) || 1;
    const status = searchParams?.status || undefined;
    const pageSize = Number(searchParams?.pageSize) || 20;

    const { orders, total, page: currentPage, pageSize: currentPageSize } = await listOrders({
        page,
        pageSize,
        status,
    });

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

                <SalesOrdersClient
                    initialOrders={orders || []}
                    total={total}
                    page={currentPage}
                    pageSize={currentPageSize}
                    statusFilter={status}
                />
            </div>
        </PageFrame>
    );
}
