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
          <div className="flex items-center justify-between">
            <CardTitle>Orders Ready for QC Review</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead>Picked By</TableHead>
                <TableHead>Completed</TableHead>
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
                  <TableCell className="text-center">{item.totalQty}</TableCell>
                  <TableCell>
                    {item.pickerName ? (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {item.pickerName}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
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
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No orders match your search
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

