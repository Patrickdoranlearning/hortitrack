'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Truck,
  ChevronRight,
  Ban,
  CheckCircle2,
  Clock,
  Package,
  Send,
  Check
} from 'lucide-react';
import { updateOrderStatus, voidOrder } from '@/app/sales/orders/[orderId]/actions';
import type { OrderDetails } from './OrderDetailPage';
import { TrolleyReconciliationCard } from '@/components/shared/TrolleyReconciliationCard';
import { CustomerTrolleyBadge } from '@/components/shared/CustomerTrolleyBadge';

interface OrderSummaryCardProps {
  order: OrderDetails;
  onStatusChange: () => void;
}

// Order status enum: draft, confirmed, picking, ready, packed, dispatched, delivered, cancelled, void
// Note: 'ready' and 'packed' both exist - 'packed' is set when picking completes, 'ready' is manual
const STATUS_FLOW = [
  { status: 'draft', label: 'Draft', icon: Clock },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { status: 'picking', label: 'Picking', icon: Package },
  { status: 'packed', label: 'Ready', icon: Check }, // 'packed' status, displayed as 'Ready'
  { status: 'dispatched', label: 'Dispatched', icon: Send },
  { status: 'delivered', label: 'Delivered', icon: Truck },
];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['confirmed', 'void'],
  confirmed: ['picking', 'void'],
  picking: ['packed', 'void'],
  ready: ['dispatched', 'void'], // legacy - redirect to packed behavior
  packed: ['dispatched', 'void'],
  dispatched: ['delivered'],
  delivered: [],
  cancelled: [],
  void: [],
};

export default function OrderSummaryCard({ order, onStatusChange }: OrderSummaryCardProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const customer = order.customer;
  const currentStatusIndex = STATUS_FLOW.findIndex(s => s.status === order.status);
  const nextStatuses = STATUS_TRANSITIONS[order.status] || [];
  const nextMainStatus = nextStatuses.find(s => s !== 'void');

  const formatAddress = () => {
    if (!customer) return null;
    const parts = [
      customer.address_line1,
      customer.address_line2,
      customer.city,
      customer.county,
      customer.eircode
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const result = await updateOrderStatus(order.id, newStatus);
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Status Updated',
          description: `Order status changed to ${newStatus}`,
        });
        onStatusChange();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update order status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVoidOrder = async () => {
    setIsUpdating(true);
    try {
      const result = await voidOrder(order.id);
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Order Voided',
          description: 'The order has been voided',
        });
        onStatusChange();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to void order',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Customer Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-lg">{customer?.name || 'Unknown Customer'}</p>
            {customer?.id && <CustomerTrolleyBadge customerId={customer.id} size="sm" />}
          </div>

          {customer?.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${customer.email}`} className="hover:underline">
                {customer.email}
              </a>
            </div>
          )}

          {customer?.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <a href={`tel:${customer.phone}`} className="hover:underline">
                {customer.phone}
              </a>
            </div>
          )}

          {formatAddress() && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5" />
              <span>{formatAddress()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Order Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Order Date</p>
              <p className="font-medium">
                {format(new Date(order.created_at), 'PPP')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Delivery Date</p>
              <p className="font-medium">
                {order.requested_delivery_date 
                  ? format(new Date(order.requested_delivery_date), 'PPP')
                  : 'Not specified'}
              </p>
            </div>
          </div>

          {/* Trolley Reconciliation - show estimated vs actual */}
          {(order.trolleys_estimated || order.pick_lists.some(p => p.trolleys_used)) && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Trolleys</p>
              <TrolleyReconciliationCard
                estimated={order.trolleys_estimated}
                actual={order.pick_lists[0]?.trolleys_used ?? null}
                compact
              />
            </div>
          )}

          {order.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm mt-1">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Totals Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Total</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal (ex VAT)</span>
            <span>€{order.subtotal_ex_vat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">VAT</span>
            <span>€{order.vat_amount.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold text-lg">
            <span>Total</span>
            <span>€{order.total_inc_vat.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Status Workflow Card - Full Width */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-lg">Order Status</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Status Timeline */}
          <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2">
            {STATUS_FLOW.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.status === order.status;
              const isCompleted = index < currentStatusIndex;
              const isVoid = order.status === 'void';
              
              return (
                <div key={step.status} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                        ${isVoid ? 'border-red-300 bg-red-50 text-red-500' :
                          isActive ? 'border-green-500 bg-green-500 text-white' :
                          isCompleted ? 'border-green-500 bg-green-50 text-green-500' :
                          'border-gray-300 bg-gray-50 text-gray-400'}
                      `}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`
                      text-xs mt-2 font-medium
                      ${isActive ? 'text-green-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}
                    `}>
                      {step.label}
                    </span>
                  </div>
                  {index < STATUS_FLOW.length - 1 && (
                    <ChevronRight className={`
                      h-5 w-5 mx-2
                      ${index < currentStatusIndex ? 'text-green-500' : 'text-gray-300'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Void Badge */}
          {order.status === 'void' && (
            <div className="flex justify-center mb-6">
              <Badge variant="destructive" className="text-lg px-4 py-1">
                <Ban className="h-4 w-4 mr-2" />
                Order Voided
              </Badge>
            </div>
          )}

          {/* Action Buttons */}
          {order.status !== 'void' && order.status !== 'delivered' && (
            <div className="flex items-center justify-center gap-3 pt-4 border-t">
              {nextMainStatus && (
                <Button 
                  onClick={() => handleStatusUpdate(nextMainStatus)}
                  disabled={isUpdating}
                >
                  Move to {STATUS_FLOW.find(s => s.status === nextMainStatus)?.label}
                </Button>
              )}

              {nextStatuses.includes('void') && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-red-600 hover:text-red-700" disabled={isUpdating}>
                      <Ban className="h-4 w-4 mr-2" />
                      Void Order
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Void Order?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The order will be marked as void and cannot be processed further.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleVoidOrder}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Void Order
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}







