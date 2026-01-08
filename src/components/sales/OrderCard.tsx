'use client';

import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import OrderStatusBadge from './OrderStatusBadge';
import type { SalesOrderWithCustomer } from '@/app/sales/orders/SalesOrdersClient';

interface OrderCardProps {
  order: SalesOrderWithCustomer;
  onOpen: () => void;
  onCopy?: () => void;
}

export default function OrderCard({ order, onOpen, onCopy }: OrderCardProps) {
  const customerName = order.customer?.name || 'Unknown Customer';

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
        <div className="text-sm font-medium mt-1">{customerName}</div>
        <div className="text-xl font-semibold mt-2">
          {order.total_inc_vat ? `€${order.total_inc_vat.toFixed(2)}` : '€0.00'}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {order.created_at ? format(new Date(order.created_at), 'PPP') : 'No date'}
        </div>
        <div className="flex items-center gap-2">
          {order.requested_delivery_date && (
            <div className="text-xs text-muted-foreground">
              Delivery: {format(new Date(order.requested_delivery_date), 'MMM d')}
            </div>
          )}
          {onCopy && (
            <button
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
            >
              Copy to new order
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
