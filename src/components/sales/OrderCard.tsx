
'use client';

import { Card } from '@/components/ui/card';
import { SalesOrder } from '@/lib/sales/types';
import { format } from 'date-fns';
import OrderStatusBadge from './OrderStatusBadge';

interface OrderCardProps {
  order: SalesOrder;
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
          <div className="font-bold text-lg">#{order.order_number}</div>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="text-sm text-muted-foreground">{order.customer_id}</div>
        <div className="text-sm text-muted-foreground">
          {order.total_inc_vat ? `€${order.total_inc_vat.toFixed(2)}` : '€0.00'}
        </div>
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        {order.created_at ? format(new Date(order.created_at), 'PPP') : 'No date'}
      </div>
    </Card>
  );
}
