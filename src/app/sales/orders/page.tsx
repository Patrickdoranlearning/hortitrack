import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import Link from 'next/link';
import SalesOrdersClient from './SalesOrdersClient';
import { listOrders } from '@/server/sales/queries.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SalesOrdersPage(props: {
    searchParams?: Promise<{
        page?: string;
        status?: string;
        pageSize?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }>;
}) {
    const searchParams = await props.searchParams;
    const page = Number(searchParams?.page) || 1;
    const pageSize = Number(searchParams?.pageSize) || 20;
    const sortBy = searchParams?.sortBy || 'created_at';
    const sortOrder = searchParams?.sortOrder || 'desc';

    // Parse status - can be comma-separated for multiple statuses
    const statusParam = searchParams?.status;
    const status = statusParam ? statusParam.split(',').filter(Boolean) : undefined;

    const { orders, total, page: currentPage, pageSize: currentPageSize } = await listOrders({
        page,
        pageSize,
        status,
        sortBy,
        sortOrder,
    });

    return (
        <PageFrame moduleKey="sales">
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

                <ErrorBoundary>
                    <SalesOrdersClient
                        initialOrders={orders || []}
                        total={total}
                        page={currentPage}
                        pageSize={currentPageSize}
                        statusFilter={status}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                    />
                </ErrorBoundary>
            </div>
        </PageFrame>
    );
}
