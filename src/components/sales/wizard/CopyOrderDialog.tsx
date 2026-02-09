'use client';

import { useEffect, useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getCustomerRecentOrders } from '@/app/sales/actions';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  onCopy: (orderId: string) => void;
};

type RecentOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  total: number;
  deliveryDate: string | null;
  status: string;
  lineCount: number;
  currency?: string;
};

export function CopyOrderDialog({ open, onOpenChange, customerId, onCopy }: Props) {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !customerId) {
      return;
    }
    startTransition(async () => {
      const result = await getCustomerRecentOrders(customerId);
      if (result?.error) {
        setError(result.error);
        setOrders([]);
      } else {
        setError(null);
        setOrders((result.orders || []) as RecentOrder[]);
      }
    });
  }, [open, customerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Copy a previous order</DialogTitle>
        </DialogHeader>

        {!customerId && (
          <Alert>
            <AlertDescription>Select a customer first to copy their orders.</AlertDescription>
          </Alert>
        )}

        {customerId && loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading recent orders...
          </div>
        )}

        {customerId && !loading && error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {customerId && !loading && !error && orders.length === 0 && (
          <div className="text-sm text-muted-foreground">No recent orders found for this customer.</div>
        )}

        {orders.length > 0 && (
          <div className="flex-1 overflow-y-auto min-h-0 pr-2">
            <div className="space-y-2">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between border rounded-md p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">#{order.orderNumber}</span>
                      <Badge variant="outline">{order.status}</Badge>
                      <Badge variant="secondary">{order.lineCount} lines</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(order.createdAt), 'PPP')} • {order.deliveryDate ? `Delivery ${order.deliveryDate}` : 'No delivery date'}
                    </div>
                    <div className="text-sm font-medium">{formatCurrency(order.total, (order.currency as CurrencyCode) || 'EUR')}</div>
                  </div>
                  <Button size="sm" onClick={() => onCopy(order.id)}>
                    Copy Order
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
