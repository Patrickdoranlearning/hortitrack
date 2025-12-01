'use client';

import { useState } from 'react';
import { PickOrder } from '@/lib/sales/types';
import PickOrderCard from '@/components/sales/PickOrderCard';
import OrderDetailDialog from '@/components/sales/OrderDetailDialog';

interface PickingListClientProps {
    pickOrders: PickOrder[];
}

export default function PickingListClient({ pickOrders }: PickingListClientProps) {
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleOpen = (pickOrder: any) => {
        // Extract order_id from the nested relation
        const orderId = pickOrder.order_items?.order_id;
        if (orderId) {
            setSelectedOrderId(orderId);
            setIsDialogOpen(true);
        } else {
            console.error('No order ID found for pick order', pickOrder);
        }
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pickOrders.map((pickOrder) => (
                    <PickOrderCard
                        key={pickOrder.id}
                        pickOrder={pickOrder}
                        onOpen={() => handleOpen(pickOrder)}
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
