'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Package, FileText, Star } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@/types/supabase';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';

type Customer = Database['public']['Tables']['customers']['Row'];

type RecentOrder = {
  id: string;
  order_number: string;
  status: string;
  total_inc_vat: number;
  requested_delivery_date: string | null;
  created_at: string;
  customer_addresses: {
    label: string | null;
    store_name: string | null;
  } | null;
};

type FavoriteProduct = {
  id: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    hero_image_url: string | null;
    skus: {
      code: string;
      plant_varieties: { name: string | null } | null;
      plant_sizes: { name: string | null } | null;
    } | null;
  } | null;
};

type B2BDashboardClientProps = {
  customer: Customer;
  recentOrders: RecentOrder[];
  favorites: FavoriteProduct[];
  currency?: CurrencyCode;
};

// Order status enum: draft, confirmed, picking, ready (legacy), packed, dispatched, delivered, cancelled, void
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  confirmed: { label: 'Confirmed', variant: 'secondary' },
  picking: { label: 'Picking', variant: 'default' },
  ready: { label: 'Ready', variant: 'default' }, // legacy
  packed: { label: 'Ready', variant: 'default' }, // current status
  ready_for_dispatch: { label: 'Ready', variant: 'default' }, // legacy
  dispatched: { label: 'Dispatched', variant: 'default' },
  delivered: { label: 'Delivered', variant: 'default' },
  void: { label: 'Void', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export function B2BDashboardClient({ customer, recentOrders, favorites, currency = 'EUR' }: B2BDashboardClientProps) {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {customer.name}</h1>
        <p className="text-muted-foreground">
          Place orders, view invoices, and manage your account
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Order</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/b2b/orders/new">Place an Order</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/b2b/orders">View Order History</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/b2b/invoices">View Invoices</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Your last 5 orders</CardDescription>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet. Place your first order!</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status] || { label: order.status, variant: 'outline' };
                return (
                  <Link
                    key={order.id}
                    href={`/b2b/orders/${order.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">#{order.order_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {order.customer_addresses?.label || order.customer_addresses?.store_name || 'Main address'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'dd/MM/yyyy')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(order.total_inc_vat ?? 0, currency)}
                        </div>
                        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Favorite Products */}
      {favorites.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              <CardTitle>Favorite Products</CardTitle>
            </div>
            <CardDescription>Quick add your favorite items to cart</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((fav) => {
                if (!fav.products) return null;
                const product = fav.products;
                const variety = product.skus?.plant_varieties?.name;
                const size = product.skus?.plant_sizes?.name;

                return (
                  <div
                    key={fav.id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {variety} {size && `• ${size}`}
                      </div>
                    </div>
                    <Button size="sm" asChild>
                      <Link href={`/b2b/orders/new?product=${product.id}`}>Add</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
