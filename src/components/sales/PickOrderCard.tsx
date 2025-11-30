
'use client';

import { Card } from '@/components/ui/card';
import { PickOrder } from '@/lib/sales/types';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface PickOrderCardProps {
    pickOrder: PickOrder;
    onOpen: () => void;
}

export default function PickOrderCard({ pickOrder, onOpen }: PickOrderCardProps) {
    return (
        <Card
            className="p-4 flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow"
            onClick={onOpen}
        >
            <div>
                <div className="flex justify-between items-start">
                    <div className="font-bold text-lg">Pick #{pickOrder.id.slice(0, 7)}</div>
                    <Badge variant={pickOrder.status === 'picked' ? 'default' : 'secondary'}>
                        {pickOrder.status}
                    </Badge>
                </div>
                <div className="text-sm text-muted-foreground">Item: {pickOrder.order_item_id.slice(0, 7)}...</div>
                <div className="text-sm text-muted-foreground">
                    Picked: {pickOrder.picked_qty ?? 0}
                </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
                {pickOrder.created_at ? format(new Date(pickOrder.created_at), 'PPP') : 'No date'}
            </div>
        </Card>
    );
}
