'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { emitMutation } from '@/lib/events/mutation-events';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  Truck,
  Calendar,
  Package,
  MapPin,
  GripVertical,
  Send,
  Undo2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { DeliveryRunWithItems } from '@/lib/dispatch/types';
import { dispatchLoad, recallLoad, deleteLoad } from '@/server/dispatch/board-actions';

interface LoadDetailClientProps {
  load: DeliveryRunWithItems;
  haulierName?: string;
  vehicleName?: string;
  vehicleCapacity: number;
}

export default function LoadDetailClient({
  load,
  haulierName,
  vehicleName,
  vehicleCapacity,
}: LoadDetailClientProps) {
  const router = useRouter();
  const [isDispatching, setIsDispatching] = useState(false);
  const [isRecalling, setIsRecalling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDispatchWarning, setShowDispatchWarning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Calculate stats
  const stats = useMemo(() => {
    const totalOrders = load.items.length;
    const totalTrolleys = load.items.reduce(
      (sum, item) => sum + (item.trolleysDelivered || 0),
      0
    );
    const fillPercentage = vehicleCapacity > 0
      ? Math.round((totalTrolleys / vehicleCapacity) * 100)
      : 0;

    // Check if orders are ready for dispatch based on ORDER status (not delivery item status)
    // An order is "ready" if it's packed/ready, or already dispatched/delivered
    const readyStatuses = ['packed', 'ready', 'dispatched', 'delivered'];
    const readyOrders = load.items.filter(
      (item) => readyStatuses.includes(item.order.orderStatus || '')
    ).length;
    const allReady = readyOrders === totalOrders && totalOrders > 0;

    return {
      totalOrders,
      totalTrolleys,
      fillPercentage,
      allReady,
      readyOrders,
    };
  }, [load.items, vehicleCapacity]);

  const handleDispatch = async (force = false) => {
    if (!force && !stats.allReady) {
      setShowDispatchWarning(true);
      return;
    }

    setIsDispatching(true);
    try {
      const result = await dispatchLoad(load.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Load dispatched with ${result.ordersDispatched} orders`);
        emitMutation({ resource: 'orders', action: 'update' });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to dispatch load');
    } finally {
      setIsDispatching(false);
      setShowDispatchWarning(false);
      setOverrideReason('');
    }
  };

  const handleRecall = async () => {
    setIsRecalling(true);
    try {
      const result = await recallLoad(load.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Load recalled - ${result.ordersRecalled} orders reverted`);
        emitMutation({ resource: 'orders', action: 'update' });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to recall load');
    } finally {
      setIsRecalling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteLoad(load.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Route deleted successfully');
        router.push('/dispatch/manager/orders');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete route');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isDispatched = load.status === 'in_transit';
  const isCompleted = load.status === 'completed';
  const canDispatch = !isDispatched && !isCompleted && stats.totalOrders > 0;
  const canRecall = isDispatched;
  const canDelete = !isDispatched && !isCompleted && stats.totalOrders === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/dispatch/manager/orders">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">
                {load.loadCode || load.runNumber}
              </h1>
              <p className="text-muted-foreground text-sm">
                {load.runDate && format(parseISO(load.runDate), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDispatched && (
            <Badge variant="default" className="bg-green-600 text-sm">
              <Truck className="h-3.5 w-3.5 mr-1" />
              Dispatched
            </Badge>
          )}
          {isCompleted && (
            <Badge variant="default" className="bg-blue-600 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Completed
            </Badge>
          )}
          {!isDispatched && !isCompleted && (
            <Badge variant="secondary" className="text-sm">
              <Clock className="h-3.5 w-3.5 mr-1" />
              {load.status === 'loading' ? 'Loading' : 'Planned'}
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Orders</p>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trolleys</p>
                <p className="text-2xl font-bold">
                  {stats.totalTrolleys} / {vehicleCapacity}
                </p>
              </div>
              <Truck className="h-8 w-8 text-muted-foreground" />
            </div>
            <Progress value={Math.min(stats.fillPercentage, 100)} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {stats.fillPercentage}% capacity
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Haulier</p>
                <p className="text-lg font-semibold truncate">
                  {haulierName || 'Not assigned'}
                </p>
              </div>
              <Truck className="h-8 w-8 text-muted-foreground" />
            </div>
            {vehicleName && (
              <p className="text-sm text-muted-foreground mt-1">{vehicleName}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {stats.allReady ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">Ready</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">Not Ready</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.readyOrders} of {stats.totalOrders} orders ready
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {canDispatch && (
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => handleDispatch()}
            disabled={isDispatching}
          >
            {isDispatching ? (
              <>Dispatching...</>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Dispatch Load
              </>
            )}
          </Button>
        )}
        {canRecall && (
          <Button
            size="lg"
            variant="outline"
            className="text-amber-600 border-amber-600 hover:bg-amber-50"
            onClick={handleRecall}
            disabled={isRecalling}
          >
            {isRecalling ? (
              <>Recalling...</>
            ) : (
              <>
                <Undo2 className="h-4 w-4 mr-2" />
                Recall Load
              </>
            )}
          </Button>
        )}
        <Link href={`/dispatch/driver?runId=${load.id}`}>
          <Button variant="outline" size="lg">
            <Truck className="h-4 w-4 mr-2" />
            Driver View
          </Button>
        </Link>
        {canDelete && (
          <Button
            size="lg"
            variant="outline"
            className="text-red-600 border-red-600 hover:bg-red-50"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>Deleting...</>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Route
              </>
            )}
          </Button>
        )}
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders in Load</CardTitle>
          <CardDescription>
            Orders are delivered in sequence order. Drag to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {load.items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No orders in this load</p>
              <p className="text-sm">
                Assign orders from the{' '}
                <Link href="/dispatch/manager/orders" className="text-primary underline">
                  Orders page
                </Link>
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Trolleys</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {load.items.map((item, index) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-medium text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-50 cursor-grab" />
                        {item.sequenceNumber || index + 1}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/sales/orders/${item.orderId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        #{item.order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{item.order.customerName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.order.orderStatus === 'packed' || item.order.orderStatus === 'ready'
                            ? 'default'
                            : item.order.orderStatus === 'dispatched' || item.order.orderStatus === 'delivered'
                            ? 'secondary'
                            : 'outline'
                        }
                        className={cn(
                          item.order.orderStatus === 'packed' || item.order.orderStatus === 'ready'
                            ? 'bg-green-500'
                            : item.order.orderStatus === 'picking'
                            ? 'bg-yellow-500'
                            : item.order.orderStatus === 'confirmed'
                            ? 'bg-blue-500'
                            : ''
                        )}
                      >
                        {item.order.orderStatus === 'packed' ? 'Ready' : item.order.orderStatus?.replace(/_/g, ' ') || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.order.shipToAddress ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {item.order.shipToAddress.county}
                            {item.order.shipToAddress.eircode && (
                              <span className="text-muted-foreground ml-1">
                                ({item.order.shipToAddress.eircode})
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.trolleysDelivered || '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      €{item.order.totalIncVat.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/sales/orders/${item.orderId}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dispatch Warning Dialog */}
      <AlertDialog open={showDispatchWarning} onOpenChange={setShowDispatchWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Not All Orders Ready
            </AlertDialogTitle>
            <AlertDialogDescription>
              Some orders in this load may not be fully picked or ready for dispatch.
              Are you sure you want to dispatch anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="override-reason">
              Override reason (optional)
            </Label>
            <Textarea
              id="override-reason"
              placeholder="e.g., Customer requested partial delivery"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDispatch(true)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Dispatch Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Route?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the route "{load.loadCode || load.runNumber}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Route
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
