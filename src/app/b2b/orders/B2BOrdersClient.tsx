'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Package, RefreshCw } from 'lucide-react';
import { reorderFromPastOrder } from './actions';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';

type Order = {
  id: string;
  order_number: string;
  status: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  requested_delivery_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer_addresses: {
    label: string | null;
    store_name: string | null;
    line1: string | null;
    city: string | null;
  } | null;
};

type B2BOrdersClientProps = {
  orders: Order[];
  customerId: string;
  currency?: CurrencyCode;
};

// Order status enum: draft, confirmed, picking, ready (legacy), packed, dispatched, delivered, cancelled, void
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  confirmed: { label: 'Confirmed', variant: 'secondary' },
  picking: { label: 'Picking', variant: 'default' },
  ready: { label: 'Ready', variant: 'default' }, // legacy
  packed: { label: 'Ready', variant: 'default' }, // current status for "ready"
  ready_for_dispatch: { label: 'Ready', variant: 'default' }, // legacy
  dispatched: { label: 'Dispatched', variant: 'default' },
  delivered: { label: 'Delivered', variant: 'default' },
  void: { label: 'Void', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export function B2BOrdersClient({ orders, customerId, currency = 'EUR' }: B2BOrdersClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (search && !order.order_number.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const handleReorder = async (orderId: string) => {
    setReorderingId(orderId);
    try {
      const result = await reorderFromPastOrder(orderId);
      if (result.success && result.items) {
        // Store reorder items in sessionStorage for the new order page to pick up
        sessionStorage.setItem('b2b_reorder_items', JSON.stringify(result.items));
        // Redirect to new order page with cart pre-populated
        router.push('/b2b/orders/new');
      }
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Orders</h1>
          <p className="text-muted-foreground">
            View and manage your order history
          </p>
        </div>
        <Button asChild>
          <Link href="/b2b/orders/new">Place New Order</Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by order number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="picking">Picking</SelectItem>
                  <SelectItem value="packed">Ready</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {search || statusFilter !== 'all'
                ? 'No orders found matching your filters.'
                : 'No orders yet. Place your first order!'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button asChild className="mt-4">
                <Link href="/b2b/orders/new">Place an Order</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status] || { label: order.status, variant: 'outline' };
            const addressLabel =
              order.customer_addresses?.label ||
              order.customer_addresses?.store_name ||
              `${order.customer_addresses?.line1}, ${order.customer_addresses?.city}` ||
              'Main address';

            return (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">#{order.order_number}</CardTitle>
                      <CardDescription>
                        Ordered on {format(new Date(order.created_at), 'dd/MM/yyyy')}
                      </CardDescription>
                    </div>
                    <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Delivery Address</p>
                      <p className="font-medium">{addressLabel}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Delivery Date</p>
                      <p className="font-medium">
                        {order.requested_delivery_date
                          ? format(new Date(order.requested_delivery_date), 'dd/MM/yyyy')
                          : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="font-medium text-lg">{formatCurrency(order.total_inc_vat, currency)}</p>
                    </div>
                    <div className="flex items-end gap-2">
                      <Link href={`/b2b/orders/${order.id}`} className="flex-1">
                        <Button variant="outline" className="w-full">View Details</Button>
                      </Link>
                      <Button
                        variant="outline"
                        onClick={() => handleReorder(order.id)}
                        disabled={reorderingId === order.id}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${reorderingId === order.id ? 'animate-spin' : ''}`} />
                        Re-order
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
