'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import OrderCard from '@/components/sales/OrderCard';

export interface SalesOrderWithCustomer {
    id: string;
    org_id: string;
    customer_id: string;
    order_number: string;
    status: string;
    subtotal_ex_vat: number | null;
    vat_amount: number | null;
    total_inc_vat: number | null;
    requested_delivery_date: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    customer?: {
        name: string;
    } | null;
}

interface SalesOrdersClientProps {
    initialOrders: SalesOrderWithCustomer[];
    total: number;
    page: number;
    pageSize: number;
    statusFilter?: string;
}

export default function SalesOrdersClient({ initialOrders, total, page, pageSize, statusFilter }: SalesOrdersClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

    const updateQuery = (nextPage: number, nextStatus?: string | null) => {
        const params = new URLSearchParams(searchParams?.toString() || '');
        params.set('page', String(nextPage));
        params.set('pageSize', String(pageSize));
        if (nextStatus) {
            params.set('status', nextStatus);
        } else {
            params.delete('status');
        }
        router.push(`/sales/orders?${params.toString()}`);
    };

    const handleStatusChange = (nextStatus: string) => {
        updateQuery(1, nextStatus || null);
    };

    const handleOpenOrder = (orderId: string) => {
        router.push(`/sales/orders/${orderId}`);
    };

  const handleCopyOrder = (orderId: string) => {
    router.push(`/sales/orders/new?copyOrderId=${orderId}`);
  };

    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <label className="text-sm text-muted-foreground">Status</label>
                    <select
                        className="border rounded px-2 py-1 text-sm"
                        value={statusFilter ?? ''}
                        onChange={(e) => handleStatusChange(e.target.value || '')}
                    >
                        <option value="">All</option>
                        <option value="draft">Draft</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="picking">Picking</option>
                        <option value="ready">Ready</option>
                        <option value="dispatched">Dispatched</option>
                        <option value="delivered">Delivered</option>
                        <option value="void">Void</option>
                    </select>
                </div>
                <div className="text-sm text-muted-foreground">
                    Page {page} / {totalPages} • {total} orders
                </div>
            </div>

            {initialOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    No orders yet. Create your first order to get started.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {initialOrders.map((order) => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onOpen={() => handleOpenOrder(order.id)}
              onCopy={() => handleCopyOrder(order.id)}
                        />
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between mt-6">
                <button
                    className="border rounded px-3 py-1 text-sm disabled:opacity-50"
                    onClick={() => updateQuery(Math.max(1, page - 1), statusFilter ?? null)}
                    disabled={page <= 1}
                >
                    Previous
                </button>
                <button
                    className="border rounded px-3 py-1 text-sm disabled:opacity-50"
                    onClick={() => updateQuery(Math.min(totalPages, page + 1), statusFilter ?? null)}
                    disabled={page >= totalPages}
                >
                    Next
                </button>
            </div>
        </>
    );
}
