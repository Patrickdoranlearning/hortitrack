
'use client';

import { Card } from '@/components/ui/card';
import { SalesOrderDoc } from '@/lib/sales/types';
import { format } from 'date-fns';
import OrderStatusBadge from './OrderStatusBadge';

interface OrderCardProps {
  order: SalesOrderDoc;
  onOpen: () => void;
}

export default function OrderCard({ order, onOpen }: OrderCardProps) {
  return (
    <Card
      className="p-4 flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onOpen}
    >
      <div>
        <div className="flex justify-between items-start">
          <div className="font-bold text-lg">#{order.id?.slice(0, 7)}...</div>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="text-sm text-muted-foreground">{order.customerId}</div>
        <div className="text-sm text-muted-foreground">{order.storeId}</div>
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'PPP') : 'No date'}
      </div>
    </Card>
  );
}
