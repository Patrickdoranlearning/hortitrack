'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ViewToggle, useViewToggle } from '@/components/ui/view-toggle';
import { format, formatDistanceToNow } from 'date-fns';
import { Search, ClipboardCheck, Package, User, Clock, ArrowRight } from 'lucide-react';

interface QCQueueItem {
  id: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  totalQty: number;
  pickCompletedAt: string | null;
  pickerName: string | null;
  status: string;
}

interface QCQueueClientProps {
  items: QCQueueItem[];
}

export default function QCQueueClient({ items }: QCQueueClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { value: viewMode, setValue: setViewMode } = useViewToggle('qc-queue-view', 'table');

  const filteredItems = items.filter(item =>
    item.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartQC = (pickListId: string) => {
    router.push(`/dispatch/qc/${pickListId}`);
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{items.length}</p>
                <p className="text-sm text-muted-foreground">Awaiting QC</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {items.reduce((sum, i) => sum + i.totalQty, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Items to Check</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {items[0]?.pickCompletedAt
                    ? formatDistanceToNow(new Date(items[0].pickCompletedAt), { addSuffix: false })
                    : '-'}
                </p>
                <p className="text-sm text-muted-foreground">Oldest Waiting</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Orders Ready for QC Review</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ViewToggle
                value={viewMode}
                onChange={setViewMode}
                storageKey="qc-queue-view"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No orders match your search
            </div>
          ) : viewMode === 'card' ? (
            /* Card View */
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleStartQC(item.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold">{item.orderNumber}</div>
                        <div className="text-sm text-muted-foreground">{item.customerName}</div>
                      </div>
                      <Badge
                        variant={item.status === 'qc_pending' ? 'default' : 'secondary'}
                        className={item.status === 'completed' ? 'bg-amber-100 text-amber-800' : ''}
                      >
                        {item.status === 'qc_pending' ? 'QC Pending' : 'Ready'}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Items / Qty</span>
                        <span className="font-medium">{item.itemCount} / {item.totalQty}</span>
                      </div>

                      {item.pickCompletedAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Completed</span>
                          <span className="text-xs" title={format(new Date(item.pickCompletedAt), 'PPp')}>
                            {formatDistanceToNow(new Date(item.pickCompletedAt), { addSuffix: true })}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t">
                      <Button size="sm" className="w-full gap-2">
                        Start QC
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Qty</TableHead>
                    <TableHead className="hidden lg:table-cell">Picked By</TableHead>
                    <TableHead className="hidden md:table-cell">Completed</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{item.orderNumber}</TableCell>
                      <TableCell>{item.customerName}</TableCell>
                      <TableCell className="text-center">{item.itemCount}</TableCell>
                      <TableCell className="text-center hidden md:table-cell">{item.totalQty}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {item.pickerName ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {item.pickerName}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {item.pickCompletedAt ? (
                          <span title={format(new Date(item.pickCompletedAt), 'PPp')}>
                            {formatDistanceToNow(new Date(item.pickCompletedAt), { addSuffix: true })}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={item.status === 'qc_pending' ? 'default' : 'secondary'}
                          className={item.status === 'completed' ? 'bg-amber-100 text-amber-800' : ''}
                        >
                          {item.status === 'qc_pending' ? 'QC Pending' : 'Ready for QC'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleStartQC(item.id)}
                          className="gap-2"
                        >
                          Start QC
                          <ArrowRight className="h-4 w-4" />
                        </Button>
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
  );
}







