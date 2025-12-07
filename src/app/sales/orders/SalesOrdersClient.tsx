'use client';

import { useState } from 'react';
import OrderCard from '@/components/sales/OrderCard';
import OrderDetailDialog from '@/components/sales/OrderDetailDialog';

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
}

export default function SalesOrdersClient({ initialOrders }: SalesOrdersClientProps) {
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleOpenOrder = (orderId: string) => {
        setSelectedOrderId(orderId);
        setIsDialogOpen(true);
    };

    return (
        <>
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
                        />
                    ))}
                </div>
            )}

            <OrderDetailDialog
                orderId={selectedOrderId}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
            />
        </>
    );
}
