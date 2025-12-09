'use client';

import { format, parseISO, getWeek } from 'date-fns';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  MapPin, 
  Package, 
  Truck, 
  User,
  ExternalLink,
  ClipboardList,
  Euro
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DispatchBoardOrder } from '@/lib/dispatch/types';

interface OrderSummaryDialogProps {
  order: DispatchBoardOrder | null;
  onClose: () => void;
}

export default function OrderSummaryDialog({ order, onClose }: OrderSummaryDialogProps) {
  if (!order) return null;

  const getStatusColor = (stage: string) => {
    switch (stage) {
      case 'to_pick': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'picking': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'ready_to_load': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'on_route': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'to_pick': return 'To Pick';
      case 'picking': return 'Picking';
      case 'ready_to_load': return 'Ready to Load';
      case 'on_route': return 'On Route';
      default: return stage;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              Order #{order.orderNumber}
            </DialogTitle>
            <Badge 
              variant="secondary" 
              className={cn("font-normal", getStatusColor(order.stage))}
            >
              {getStageLabel(order.stage)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer */}
          <div>
            <h3 className="text-lg font-semibold">{order.customerName}</h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              {order.county && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {order.county}
                </span>
              )}
              {order.eircode && (
                <span className="font-mono">{order.eircode}</span>
              )}
            </div>
          </div>

          <Separator />

          {/* Order Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Delivery Date */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Delivery Date</span>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {order.requestedDeliveryDate ? (
                  <span>
                    {format(parseISO(order.requestedDeliveryDate), 'EEE, MMM d')}
                    <span className="text-muted-foreground ml-1">
                      (W{getWeek(parseISO(order.requestedDeliveryDate))})
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </div>
            </div>

            {/* Trolleys */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Trolleys</span>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>{order.trolleysEstimated || 0}</span>
              </div>
            </div>

            {/* Route */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Route</span>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                {order.routeName || order.deliveryRunNumber ? (
                  <Badge 
                    variant="secondary" 
                    className="font-normal"
                    style={order.routeColor ? { 
                      backgroundColor: order.routeColor, 
                      color: getContrastColor(order.routeColor),
                      borderColor: order.routeColor 
                    } : undefined}
                  >
                    {order.routeName || order.deliveryRunNumber}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">Not assigned</span>
                )}
              </div>
            </div>

            {/* Picker */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Picker</span>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {order.pickerName ? (
                  <span>{order.pickerName}</span>
                ) : (
                  <span className="text-muted-foreground">Not assigned</span>
                )}
              </div>
            </div>

            {/* Haulier */}
            {order.haulierName && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Haulier</span>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>{order.haulierName}</span>
                </div>
              </div>
            )}

            {/* Order Total */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total</span>
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{formatCurrency(order.totalIncVat)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild className="flex-1">
              <Link href={`/sales/orders/${order.id}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Order Details
              </Link>
            </Button>
            
            {order.pickListId ? (
              <Button asChild variant="secondary" className="flex-1">
                <Link href={`/dispatch/picking/${order.pickListId}/workflow`}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  {order.stage === 'to_pick' ? 'Start Picking' : 'View Picking'}
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" className="flex-1" disabled>
                <ClipboardList className="h-4 w-4 mr-2" />
                No Pick List
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper to determine text color based on background
function getContrastColor(hexColor: string) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

