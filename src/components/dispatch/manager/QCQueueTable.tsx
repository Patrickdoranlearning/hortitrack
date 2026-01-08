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
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  ClipboardCheck,
  Package,
  User,
  Clock,
  ArrowRight,
  MessageSquarePlus,
} from 'lucide-react';
import { CreateQCFeedbackDialog } from './CreateQCFeedbackDialog';

interface QCQueueItem {
  id: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  totalQty: number;
  pickCompletedAt: string | null;
  pickerName: string | null;
  pickerUserId: string | null;
  status: string;
  qcStatus: string | null;
}

interface QCQueueTableProps {
  items: QCQueueItem[];
}

export function QCQueueTable({ items }: QCQueueTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackItem, setFeedbackItem] = useState<QCQueueItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.pickerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartQC = (pickListId: string) => {
    router.push(`/dispatch/qc/${pickListId}`);
  };

  const getStatusBadge = (status: string, qcStatus: string | null) => {
    if (qcStatus === 'passed') {
      return <Badge className="bg-green-600">Passed</Badge>;
    }
    if (qcStatus === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (status === 'qc_pending') {
      return <Badge variant="secondary">QC Pending</Badge>;
    }
    return <Badge variant="outline">Awaiting Review</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              QC Review Queue
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <TableHead>Picker</TableHead>
                <TableHead>Waiting</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <p className="text-muted-foreground">No items found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.orderNumber}</TableCell>
                    <TableCell>{item.customerName}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{item.totalQty}</span>
                        <span className="text-muted-foreground text-xs">
                          ({item.itemCount} lines)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.pickerName ? (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{item.pickerName}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.pickCompletedAt ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatDistanceToNow(new Date(item.pickCompletedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status, item.qcStatus)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setFeedbackItem(item)}
                          title="Add Feedback"
                        >
                          <MessageSquarePlus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleStartQC(item.id)}
                          className="gap-1"
                        >
                          Review
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Feedback Dialog */}
      {feedbackItem && (
        <CreateQCFeedbackDialog
          pickListId={feedbackItem.id}
          orderNumber={feedbackItem.orderNumber}
          customerName={feedbackItem.customerName}
          open={!!feedbackItem}
          onOpenChange={(open) => !open && setFeedbackItem(null)}
        />
      )}
    </>
  );
}
