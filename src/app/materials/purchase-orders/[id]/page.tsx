'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft,
  Send,
  XCircle,
  Package,
  FileText,
  Truck,
  CheckCircle2,
  Clock,
  Building2,
} from 'lucide-react';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { fetchJson } from '@/lib/http/fetchJson';
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '@/lib/types/materials';

type PurchaseOrderResponse = {
  order: PurchaseOrder;
};

type ReceiveLineInput = {
  lineId: string;
  quantityReceived: number;
  notes: string;
};

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const showReceiveDialog = searchParams.get('receive') === 'true';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReceiving, setShowReceiving] = useState(showReceiveDialog);
  const [receiveLines, setReceiveLines] = useState<ReceiveLineInput[]>([]);
  const [receiveNotes, setReceiveNotes] = useState('');

  // Fetch order
  const {
    data: orderData,
    mutate: mutateOrder,
    isLoading,
  } = useSWR<PurchaseOrderResponse>(
    `/api/materials/purchase-orders/${id}`,
    (url) => fetchJson(url)
  );

  const order = orderData?.order;

  // Initialize receive lines when order loads or dialog opens
  useEffect(() => {
    if (order?.lines && showReceiving) {
      setReceiveLines(
        order.lines.map((line) => ({
          lineId: line.id,
          quantityReceived: Math.max(0, line.quantityOrdered - line.quantityReceived),
          notes: '',
        }))
      );
    }
  }, [order?.lines, showReceiving]);

  const getStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">Submitted</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="border-indigo-500 text-indigo-600">Confirmed</Badge>;
      case 'partially_received':
        return <Badge variant="outline" className="border-amber-500 text-amber-600">Partially Received</Badge>;
      case 'received':
        return <Badge className="bg-green-600">Received</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-5 w-5 text-muted-foreground" />;
      case 'submitted':
        return <Send className="h-5 w-5 text-blue-500" />;
      case 'confirmed':
        return <Clock className="h-5 w-5 text-indigo-500" />;
      case 'partially_received':
        return <Package className="h-5 w-5 text-amber-500" />;
      case 'received':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getLineProgress = (line: PurchaseOrderLine) => {
    if (line.quantityOrdered === 0) return 0;
    return (line.quantityReceived / line.quantityOrdered) * 100;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await fetchJson(`/api/materials/purchase-orders/${id}/submit`, {
        method: 'POST',
      });
      toast({ title: 'Purchase order submitted' });
      mutateOrder();
    } catch (error) {
      toast({
        title: 'Failed to submit',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await fetchJson(`/api/materials/purchase-orders/${id}`, {
        method: 'DELETE',
      });
      toast({ title: 'Purchase order cancelled' });
      router.push('/materials/purchase-orders');
    } catch (error) {
      toast({
        title: 'Failed to cancel',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
    setShowCancelDialog(false);
  };

  const handleReceive = async () => {
    const linesToReceive = receiveLines.filter((l) => l.quantityReceived > 0);
    if (linesToReceive.length === 0) {
      toast({ title: 'Enter quantities to receive', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchJson(`/api/materials/purchase-orders/${id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          lines: linesToReceive,
          notes: receiveNotes || undefined,
        }),
      });
      toast({ title: 'Goods received successfully' });
      setShowReceiving(false);
      setReceiveNotes('');
      mutateOrder();
    } catch (error) {
      toast({
        title: 'Failed to receive goods',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateReceiveLine = (lineId: string, qty: number) => {
    setReceiveLines(
      receiveLines.map((l) =>
        l.lineId === lineId ? { ...l, quantityReceived: qty } : l
      )
    );
  };

  if (isLoading) {
    return (
      <PageFrame companyName="Doran Nurseries" moduleKey="materials">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </PageFrame>
    );
  }

  if (!order) {
    return (
      <PageFrame companyName="Doran Nurseries" moduleKey="materials">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Purchase order not found</p>
          <Button className="mt-4" onClick={() => router.push('/materials/purchase-orders')}>
            Back to Orders
          </Button>
        </div>
      </PageFrame>
    );
  }

  const canSubmit = order.status === 'draft';
  const canReceive = ['submitted', 'confirmed', 'partially_received'].includes(order.status);
  const canCancel = order.status !== 'received' && order.status !== 'cancelled';

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="materials">
      <div className="space-y-6">
        <ModulePageHeader
          title={order.poNumber}
          description={`Order to ${order.supplier?.name ?? 'Unknown Supplier'}`}
          actionsSlot={
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => router.push('/materials/purchase-orders')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              {canSubmit && (
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  <Send className="mr-2 h-4 w-4" />
                  Submit
                </Button>
              )}
              {canReceive && (
                <Button onClick={() => setShowReceiving(true)}>
                  <Package className="mr-2 h-4 w-4" />
                  Receive Goods
                </Button>
              )}
              {canCancel && (
                <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}
            </div>
          }
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  {getStatusIcon(order.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Created {formatDate(order.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
                <CardDescription>
                  {order.lines?.length ?? 0} items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Ordered</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.lines?.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{line.material?.name}</span>
                              <span className="text-muted-foreground text-sm ml-2">
                                ({line.material?.partNumber})
                              </span>
                            </div>
                            {order.status !== 'draft' && (
                              <div className="mt-2">
                                <Progress
                                  value={getLineProgress(line)}
                                  className="h-2"
                                />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {line.quantityOrdered}
                          </TableCell>
                          <TableCell className="text-right">
                            {line.quantityReceived > 0 ? (
                              <span
                                className={
                                  line.quantityReceived >= line.quantityOrdered
                                    ? 'text-green-600'
                                    : 'text-amber-600'
                                }
                              >
                                {line.quantityReceived}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(line.unitPrice)}
                            {line.discountPct > 0 && (
                              <span className="text-green-600 text-sm ml-1">
                                -{line.discountPct}%
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(line.lineTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Supplier Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Supplier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{order.supplier?.name}</p>
                {order.supplierRef && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Ref: {order.supplierRef}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Delivery Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Delivery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Expected Date</span>
                  <p className="font-medium">{formatDate(order.expectedDeliveryDate)}</p>
                </div>
                {order.deliveryLocation && (
                  <div>
                    <span className="text-sm text-muted-foreground">Location</span>
                    <p className="font-medium">{order.deliveryLocation.name}</p>
                  </div>
                )}
                {order.deliveryNotes && (
                  <div>
                    <span className="text-sm text-muted-foreground">Notes</span>
                    <p className="text-sm">{order.deliveryNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                {order.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(order.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(order.totalAmount)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {order.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{order.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Receive Goods Dialog */}
      <Dialog open={showReceiving} onOpenChange={setShowReceiving}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receive Goods</DialogTitle>
            <DialogDescription>
              Enter the quantities received for each line item
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Already Received</TableHead>
                  <TableHead className="text-right">Receive Now</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines?.map((line) => {
                  const receiveLine = receiveLines.find((r) => r.lineId === line.id);
                  const remaining = line.quantityOrdered - line.quantityReceived;
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <span className="font-medium">{line.material?.name}</span>
                        <span className="text-muted-foreground text-sm block">
                          {line.material?.partNumber}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{line.quantityOrdered}</TableCell>
                      <TableCell className="text-right">{line.quantityReceived}</TableCell>
                      <TableCell className="text-right">
                        {remaining > 0 ? (
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            value={receiveLine?.quantityReceived ?? 0}
                            onChange={(e) =>
                              updateReceiveLine(
                                line.id,
                                Math.min(remaining, parseInt(e.target.value) || 0)
                              )
                            }
                            className="w-20 ml-auto"
                          />
                        ) : (
                          <Badge variant="outline" className="text-green-600">
                            Complete
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="space-y-2">
              <Label htmlFor="receive-notes">Notes</Label>
              <Textarea
                id="receive-notes"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder="Optional notes about this receipt"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiving(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={isSubmitting}>
              {isSubmitting ? 'Receiving...' : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {order.poNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the purchase order. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Cancel Order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}
