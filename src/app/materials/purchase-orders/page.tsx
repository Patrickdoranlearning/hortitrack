'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  RefreshCw,
  FileText,
  Filter,
  ChevronDown,
  Eye,
  Send,
  XCircle,
  Package,
  Truck,
} from 'lucide-react';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useToast } from '@/hooks/use-toast';
import { fetchJson } from '@/lib/http/fetchJson';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/lib/types/materials';

type PurchaseOrdersResponse = {
  orders: PurchaseOrder[];
  total: number;
};

const STATUS_OPTIONS: { value: PurchaseOrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function PurchaseOrdersPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancellingPO, setCancellingPO] = useState<PurchaseOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch purchase orders
  const {
    data: ordersData,
    mutate: mutateOrders,
    isValidating,
  } = useSWR<PurchaseOrdersResponse>(
    `/api/materials/purchase-orders?${statusFilter !== 'all' ? `status=${statusFilter}&` : ''}search=${encodeURIComponent(search)}`,
    (url) => fetchJson(url),
    { revalidateOnFocus: false }
  );

  const orders = ordersData?.orders ?? [];

  // Stats
  const stats = useMemo(() => {
    const draft = orders.filter((o) => o.status === 'draft').length;
    const pending = orders.filter((o) => ['submitted', 'confirmed'].includes(o.status)).length;
    const receiving = orders.filter((o) => o.status === 'partially_received').length;
    return { draft, pending, receiving };
  }, [orders]);

  const getStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">Submitted</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="border-indigo-500 text-indigo-600">Confirmed</Badge>;
      case 'partially_received':
        return <Badge variant="outline" className="border-amber-500 text-amber-600">Partial</Badge>;
      case 'received':
        return <Badge className="bg-green-600">Received</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleSubmitPO = async (order: PurchaseOrder) => {
    setIsSubmitting(true);
    try {
      await fetchJson(`/api/materials/purchase-orders/${order.id}/submit`, {
        method: 'POST',
      });
      toast({ title: 'Purchase order submitted', description: order.poNumber });
      mutateOrders();
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

  const handleCancelPO = async () => {
    if (!cancellingPO) return;
    try {
      await fetchJson(`/api/materials/purchase-orders/${cancellingPO.id}`, {
        method: 'DELETE',
      });
      toast({ title: 'Purchase order cancelled' });
      setCancellingPO(null);
      mutateOrders();
    } catch (error) {
      toast({
        title: 'Failed to cancel',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
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

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="materials">
      <div className="space-y-6">
        <ModulePageHeader
          title="Purchase Orders"
          description="Manage purchase orders for materials and track incoming stock."
          actionsSlot={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => mutateOrders()}
                disabled={isValidating}
              >
                <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
              </Button>
              <Button asChild>
                <Link href="/materials/purchase-orders/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Order
                </Link>
              </Button>
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Draft Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.draft}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Delivery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.pending}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Awaiting Receipt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">{stats.receiving}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search PO number or supplier ref..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Purchase Orders ({ordersData?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isValidating && !orders.length ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No purchase orders found</p>
                <p className="text-sm">
                  {search || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Get started by creating your first purchase order'}
                </p>
                {!search && statusFilter === 'all' && (
                  <Button className="mt-4" asChild>
                    <Link href="/materials/purchase-orders/new">
                      <Plus className="mr-2 h-4 w-4" />
                      New Order
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px]">PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/materials/purchase-orders/${order.id}`)}
                      >
                        <TableCell className="font-mono font-medium">
                          {order.poNumber}
                        </TableCell>
                        <TableCell>{order.supplier?.name ?? '—'}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{formatDate(order.orderDate)}</TableCell>
                        <TableCell>{formatDate(order.expectedDeliveryDate)}</TableCell>
                        <TableCell className="text-right">
                          {order.lines?.length ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.totalAmount)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/materials/purchase-orders/${order.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {order.status === 'draft' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleSubmitPO(order)}
                                    disabled={isSubmitting}
                                  >
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit Order
                                  </DropdownMenuItem>
                                </>
                              )}
                              {['submitted', 'confirmed', 'partially_received'].includes(
                                order.status
                              ) && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/materials/purchase-orders/${order.id}?receive=true`)
                                  }
                                >
                                  <Package className="mr-2 h-4 w-4" />
                                  Receive Goods
                                </DropdownMenuItem>
                              )}
                              {order.status !== 'received' && order.status !== 'cancelled' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setCancellingPO(order)}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel Order
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Confirmation */}
      <AlertDialog
        open={!!cancellingPO}
        onOpenChange={(open) => !open && setCancellingPO(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancellingPO?.poNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the purchase order. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelPO}>Cancel Order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}
