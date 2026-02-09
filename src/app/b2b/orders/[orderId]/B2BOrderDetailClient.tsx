'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, AlertCircle, Phone, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { TrolleyReconciliationCard } from '@/components/shared/TrolleyReconciliationCard';
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
  trolleys_estimated: number | null;
  customer_addresses: {
    label: string | null;
    store_name: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    county: string | null;
    eircode: string | null;
    country_code: string | null;
  } | null;
  pick_lists: Array<{
    id: string;
    trolleys_used: number | null;
  }>;
};

type OrderItem = {
  id: string;
  product_id: string;
  sku_id: string;
  description: string | null;
  quantity: number;
  unit_price_ex_vat: number;
  vat_rate: number;
  line_total_ex_vat: number;
  line_vat_amount: number;
  rrp: number | null;
  multibuy_price_2: number | null;
  multibuy_qty_2: number | null;
  multibuy_price_3: number | null;
  multibuy_qty_3: number | null;
};

type B2BOrderDetailClientProps = {
  order: Order;
  items: OrderItem[];
  canEdit: boolean;
  currency?: CurrencyCode;
};

// Order status enum: draft, confirmed, picking, ready (legacy), packed, dispatched, delivered, cancelled, void
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  confirmed: { label: 'Confirmed', variant: 'secondary' },
  picking: { label: 'Picking', variant: 'default' },
  ready: { label: 'Ready for Dispatch', variant: 'default' }, // legacy
  packed: { label: 'Ready for Dispatch', variant: 'default' }, // current status
  ready_for_dispatch: { label: 'Ready for Dispatch', variant: 'default' }, // legacy
  dispatched: { label: 'Dispatched', variant: 'default' },
  delivered: { label: 'Delivered', variant: 'default' },
  void: { label: 'Void', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export function B2BOrderDetailClient({ order, items, canEdit, currency = 'EUR' }: B2BOrderDetailClientProps) {
  const statusConfig = STATUS_CONFIG[order.status] || { label: order.status, variant: 'outline' };
  const address = order.customer_addresses;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/b2b/orders">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Link>
      </Button>

      {/* Order Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order #{order.order_number}</h1>
          <p className="text-muted-foreground">
            Placed on {format(new Date(order.created_at), 'dd/MM/yyyy')}
          </p>
        </div>
        <Badge variant={statusConfig.variant} className="text-base px-3 py-1">
          {statusConfig.label}
        </Badge>
      </div>

      {/* Edit/Cancel Notice */}
      {canEdit && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This order can be edited. To make changes or cancel, please contact us.
          </AlertDescription>
        </Alert>
      )}

      {!canEdit && order.status !== 'delivered' && order.status !== 'cancelled' && (
        <Alert>
          <Phone className="h-4 w-4" />
          <AlertDescription>
            To cancel this order, please contact us directly.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Delivery Information */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              {address ? (
                <div className="font-medium">
                  {address.label && <p>{address.label}</p>}
                  {address.store_name && <p>{address.store_name}</p>}
                  <p>{address.line1}</p>
                  {address.line2 && <p>{address.line2}</p>}
                  <p>
                    {address.city}
                    {address.county && `, ${address.county}`}
                  </p>
                  {address.eircode && <p>{address.eircode}</p>}
                  <p>{address.country_code}</p>
                </div>
              ) : (
                <p className="font-medium">Main address</p>
              )}
            </div>
            {order.requested_delivery_date && (
              <div>
                <p className="text-sm text-muted-foreground">Requested Delivery Date</p>
                <p className="font-medium">
                  {format(new Date(order.requested_delivery_date), 'dd/MM/yyyy')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal (ex VAT):</span>
              <span className="font-medium">{formatCurrency(order.subtotal_ex_vat, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT:</span>
              <span className="font-medium">{formatCurrency(order.vat_amount, currency)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold pt-3 border-t">
              <span>Total (inc VAT):</span>
              <span>{formatCurrency(order.total_inc_vat, currency)}</span>
            </div>

            {/* Trolley Info */}
            {(order.trolleys_estimated || order.pick_lists?.some(p => p.trolleys_used)) && (
              <div className="pt-3 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Truck className="h-4 w-4" />
                  <span>Trolleys</span>
                </div>
                <TrolleyReconciliationCard
                  estimated={order.trolleys_estimated}
                  actual={order.pick_lists?.[0]?.trolleys_used ?? null}
                  compact
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Order Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
          <CardDescription>{items.length} items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Unit Price</TableHead>
                  <TableHead className="hidden md:table-cell text-right">RRP</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Multi-buy</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      {formatCurrency(item.unit_price_ex_vat, currency)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-sm text-muted-foreground">
                      {item.rrp ? formatCurrency(item.rrp, currency) : '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-sm text-muted-foreground">
                      {item.multibuy_qty_2 && item.multibuy_price_2
                        ? `${item.multibuy_qty_2} for ${formatCurrency(item.multibuy_price_2, currency)}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.line_total_ex_vat, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
