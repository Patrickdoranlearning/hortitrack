'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Search,
  ClipboardList,
  Package,
  User,
  Clock,
  ArrowRight,
  Calendar,
  Play,
} from 'lucide-react';

export interface PickingQueueItem {
  id: string;
  sequence: number;
  status: 'pending' | 'in_progress';
  assignedTo: string | null;
  startedAt: string | null;
  createdAt: string;
  orderNumber: string;
  orderId: string;
  customerName: string;
  deliveryDate: string | null;
  totalItems: number;
  totalQty: number;
  pickedQty: number;
}

interface PickingQueueTableProps {
  items: PickingQueueItem[];
}

export function PickingQueueTable({ items }: PickingQueueTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = items.filter(
    (item) =>
      item.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.assignedTo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    if (status === 'in_progress') {
      return <Badge className="bg-green-600">Picking</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const getProgressPercent = (item: PickingQueueItem): number => {
    if (item.totalQty === 0) return 0;
    return Math.round((item.pickedQty / item.totalQty) * 100);
  };

  const handleAction = (item: PickingQueueItem) => {
    router.push(`/dispatch/picking/${item.id}/workflow`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Picking Queue
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? 'No matching orders found'
                        : 'No orders waiting to be picked'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const progress = getProgressPercent(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-muted-foreground text-sm">
                        {item.sequence}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/sales/orders/${item.orderId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {item.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{item.customerName}</TableCell>
                      <TableCell>
                        {item.deliveryDate ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {format(new Date(item.deliveryDate), 'EEE, MMM d')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{item.totalQty}</span>
                          <span className="text-xs text-muted-foreground">
                            ({item.totalItems} lines)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.status === 'in_progress' ? (
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress value={progress} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-8">
                              {progress}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not started</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.assignedTo ? (
                          <div className="flex items-center gap-1 text-sm">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{item.assignedTo}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-amber-600">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={item.status === 'in_progress' ? 'default' : 'outline'}
                          onClick={() => handleAction(item)}
                          className="gap-1"
                        >
                          {item.status === 'in_progress' ? (
                            <>
                              Continue
                              <ArrowRight className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Start
                              <Play className="h-3.5 w-3.5" />
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {filteredItems.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center">
              <Package className="h-8 w-8 mb-2 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? 'No matching orders found'
                  : 'No orders waiting to be picked'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const progress = getProgressPercent(item);
              return (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  {/* Header: Sequence + Order + Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-muted-foreground">
                        #{item.sequence}
                      </span>
                      <Link
                        href={`/sales/orders/${item.orderId}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {item.orderNumber}
                      </Link>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  {/* Customer */}
                  <p className="text-sm">{item.customerName}</p>

                  {/* Details row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      <span>
                        {item.totalQty} units ({item.totalItems} lines)
                      </span>
                    </div>
                    {item.deliveryDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {format(new Date(item.deliveryDate), 'EEE, MMM d')}
                        </span>
                      </div>
                    )}
                    {item.assignedTo ? (
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        <span>{item.assignedTo}</span>
                      </div>
                    ) : (
                      <span className="text-amber-600">Unassigned</span>
                    )}
                    {item.status === 'in_progress' && item.startedAt && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          Started{' '}
                          {formatDistanceToNow(new Date(item.startedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar for in_progress */}
                  {item.status === 'in_progress' && (
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {item.pickedQty}/{item.totalQty} ({progress}%)
                      </span>
                    </div>
                  )}

                  {/* Action */}
                  <Button
                    size="sm"
                    variant={item.status === 'in_progress' ? 'default' : 'outline'}
                    onClick={() => handleAction(item)}
                    className="w-full gap-1"
                  >
                    {item.status === 'in_progress' ? (
                      <>
                        Continue Picking
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Start Picking
                        <Play className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
