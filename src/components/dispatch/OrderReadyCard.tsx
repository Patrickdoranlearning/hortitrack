'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OrderReadyForDispatch } from '@/lib/dispatch/types';
import { format } from 'date-fns';
import { Calendar, Package } from 'lucide-react';
import PackingStatusBadge from './PackingStatusBadge';

interface OrderReadyCardProps {
  order: OrderReadyForDispatch;
  onClick?: () => void;
}

export default function OrderReadyCard({ order, onClick }: OrderReadyCardProps) {
  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="font-semibold text-base">#{order.orderNumber}</div>
            <div className="text-sm text-muted-foreground">{order.customerName}</div>
          </div>
          <div className="text-right">
            <div className="font-medium">€{order.totalIncVat.toFixed(2)}</div>
            {order.packingStatus && (
              <div className="mt-1">
                <PackingStatusBadge status={order.packingStatus} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {order.requestedDeliveryDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(order.requestedDeliveryDate), 'PP')}</span>
            </div>
          )}
          {order.trolleysUsed !== undefined && order.trolleysUsed > 0 && (
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              <span>{order.trolleysUsed} trolleys</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
