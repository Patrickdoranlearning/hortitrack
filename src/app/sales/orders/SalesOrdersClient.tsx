
'use client';

import { useState } from 'react';
import OrderCard from '@/components/sales/OrderCard';
import OrderDetailDialog from '@/components/sales/OrderDetailDialog';
import { SalesOrder } from '@/lib/sales/types';

interface SalesOrdersClientProps {
    initialOrders: SalesOrder[];
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {initialOrders.map((order) => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        onOpen={() => handleOpenOrder(order.id)}
                    />
                ))}
            </div>

            <OrderDetailDialog
                orderId={selectedOrderId}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
            />
        </>
    );
}
