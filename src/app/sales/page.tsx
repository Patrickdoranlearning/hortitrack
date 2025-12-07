import { Button } from '@/components/ui/button';
import Link from 'next/link';
import * as React from 'react';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { PageFrame } from '@/ui/templates/PageFrame';
import { createClient } from '@/lib/supabase/server';
import { startOfWeek, endOfWeek, addWeeks, formatISO, format } from 'date-fns';
import { ClipboardList, ShoppingBag, FileText, Package, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type OrderStatus = 'draft' | 'confirmed' | 'picking' | 'ready' | 'dispatched' | 'delivered' | 'void';

interface RecentOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_inc_vat: number | null;
  created_at: string;
  requested_delivery_date: string | null;
  customer: {
    name: string;
  } | null;
}

function getStatusVariant(status: OrderStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'confirmed':
      return 'default';
    case 'picking':
    case 'ready':
      return 'secondary';
    case 'dispatched':
    case 'delivered':
      return 'outline';
    case 'void':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default async function SalesLandingPage() {
  const supabase = await createClient();
  const now = new Date();

  // Current Week Range
  const startCurrent = startOfWeek(now, { weekStartsOn: 1 });
  const endCurrent = endOfWeek(now, { weekStartsOn: 1 });

  // Next Week Range
  const startNext = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  const endNext = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });

  // Fetch Current Week Orders
  const { data: currentOrders } = await supabase
    .from('orders')
    .select('total_inc_vat')
    .gte('created_at', formatISO(startCurrent))
    .lte('created_at', formatISO(endCurrent));

  // Fetch Next Week Orders
  const { data: nextOrders } = await supabase
    .from('orders')
    .select('total_inc_vat')
    .gte('requested_delivery_date', formatISO(startNext))
    .lte('requested_delivery_date', formatISO(endNext));

  // Fetch Recent Orders with Customer Names
  const { data: recentOrders } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      total_inc_vat,
      created_at,
      requested_delivery_date,
      customer:customers(name)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch Orders needing action
  const { data: pendingOrders } = await supabase
    .from('orders')
    .select('id, status')
    .in('status', ['confirmed', 'picking']);

  // Fetch Orders without invoices
  const { data: ordersWithoutInvoices } = await supabase
    .from('orders')
    .select('id')
    .in('status', ['dispatched', 'delivered'])
    .is('id', null); // We'll need to check this differently

  // Count orders needing invoices (orders that are delivered but have no invoice)
  const { data: invoicedOrderIds } = await supabase
    .from('invoices')
    .select('order_id');
  
  const invoicedSet = new Set(invoicedOrderIds?.map(i => i.order_id) || []);
  
  const { data: deliveredOrders } = await supabase
    .from('orders')
    .select('id')
    .in('status', ['dispatched', 'delivered']);

  const ordersNeedingInvoice = deliveredOrders?.filter(o => !invoicedSet.has(o.id)).length || 0;

  const currentWeekRevenue = currentOrders?.reduce((sum, order) => sum + (order.total_inc_vat || 0), 0) || 0;
  const nextWeekRevenue = nextOrders?.reduce((sum, order) => sum + (order.total_inc_vat || 0), 0) || 0;
  const pendingCount = pendingOrders?.filter(o => o.status === 'confirmed').length || 0;
  const pickingCount = pendingOrders?.filter(o => o.status === 'picking').length || 0;

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <div className="space-y-8">
        <ModulePageHeader
          title="Sales"
          description="Create and manage customer sales orders."
          actionsSlot={
            <Button asChild>
              <Link href="/sales/orders/new">Create order</Link>
            </Button>
          }
        />

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="secondary" size="sm" className="gap-2">
            <Link href="/sales/orders">
              <ShoppingBag className="h-4 w-4" />
              Orders
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/dispatch/picking">
              <ClipboardList className="h-4 w-4" />
              Picking
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/sales/invoices">
              <FileText className="h-4 w-4" />
              Invoices
            </Link>
          </Button>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentOrders?.length || 0} orders</div>
              <p className="text-xs text-muted-foreground">
                €{currentWeekRevenue.toFixed(2)} revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Week</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{nextOrders?.length || 0} orders</div>
              <p className="text-xs text-muted-foreground">
                €{nextWeekRevenue.toFixed(2)} expected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Action</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount + pickingCount}</div>
              <p className="text-xs text-muted-foreground">
                {pendingCount} pending, {pickingCount} picking
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Need Invoice</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ordersNeedingInvoice}</div>
              <p className="text-xs text-muted-foreground">
                Delivered without invoice
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Order</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Total</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentOrders as RecentOrder[] || []).map((order) => (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="py-3">
                        <Link 
                          href={`/sales/orders/${order.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="py-3">
                        {order.customer?.name || 'Unknown Customer'}
                      </td>
                      <td className="py-3">
                        <Badge variant={getStatusVariant(order.status)}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-medium">
                        €{(order.total_inc_vat || 0).toFixed(2)}
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {order.created_at ? format(new Date(order.created_at), 'MMM d') : '-'}
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {order.requested_delivery_date 
                          ? format(new Date(order.requested_delivery_date), 'MMM d')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                  {(!recentOrders || recentOrders.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No orders yet. Create your first order to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {recentOrders && recentOrders.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Button asChild variant="outline" size="sm">
                  <Link href="/sales/orders">View all orders</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}
