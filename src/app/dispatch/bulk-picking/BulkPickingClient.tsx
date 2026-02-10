'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';
import {
  Package,
  Calendar,
  Plus,
  Play,
  ArrowRight,
  Loader2,
  Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderForBulk {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryDate: string | null;
  status: string;
  pickListId?: string;
  pickListStatus?: string;
  itemCount: number;
}

interface BulkBatch {
  id: string;
  batchNumber: string;
  batchDate: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  orderCount: number;
  itemCount: number;
}

interface BulkPickingClientProps {
  existingBatches: BulkBatch[];
  ordersByDate: Record<string, OrderForBulk[]>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  picked: 'bg-amber-100 text-amber-700',
  packing: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'Picking',
  picked: 'Picked',
  packing: 'Packing',
  completed: 'Completed',
};

export default function BulkPickingClient({
  existingBatches,
  ordersByDate,
}: BulkPickingClientProps) {
  const router = useRouter();
  
  const [batches] = useState<BulkBatch[]>(existingBatches);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const dates = Object.keys(ordersByDate).sort();
  
  const handleSelectAll = (date: string) => {
    const orders = ordersByDate[date] || [];
    const allSelected = orders.every((o) => selectedOrders.has(o.id));
    
    const newSelected = new Set(selectedOrders);
    orders.forEach((o) => {
      if (allSelected) {
        newSelected.delete(o.id);
      } else {
        newSelected.add(o.id);
      }
    });
    setSelectedOrders(newSelected);
  };
  
  const handleToggleOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };
  
  const handleCreateBatch = async () => {
    if (selectedOrders.size === 0 || !selectedDate) {
      toast.error('Select at least one order to create a bulk pick batch');
      return;
    }
    
    setIsCreating(true);
    try {
      const res = await fetch('/api/bulk-picking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          orderIds: Array.from(selectedOrders),
        }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        toast.error(data.error);
        return;
      }
      
      toast.success(`Bulk pick batch ${data.batch.batchNumber} created with ${data.batch.orderCount} orders`);
      
      // Navigate to the batch
      router.push(`/dispatch/bulk-picking/${data.batch.id}`);
    } catch {
      toast.error('Failed to create bulk pick batch');
    } finally {
      setIsCreating(false);
      setShowCreateDialog(false);
    }
  };
  
  const handleOpenBatch = (batchId: string) => {
    router.push(`/dispatch/bulk-picking/${batchId}`);
  };
  
  return (
    <div className="space-y-6">
      {/* Existing Batches */}
      {batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Active Bulk Batches
            </CardTitle>
            <CardDescription>Continue picking or packing existing batches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batches.map((batch) => (
                <Card
                  key={batch.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleOpenBatch(batch.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold">{batch.batchNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(batch.batchDate), 'EEE, MMM d')}
                        </p>
                      </div>
                      <Badge className={STATUS_COLORS[batch.status]}>
                        {STATUS_LABELS[batch.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {batch.orderCount} orders
                      </span>
                      <span className="flex items-center gap-1">
                        <Boxes className="h-4 w-4" />
                        {batch.itemCount} items
                      </span>
                    </div>
                    <Button className="w-full mt-3" size="sm">
                      {batch.status === 'pending' && (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start Picking
                        </>
                      )}
                      {batch.status === 'in_progress' && (
                        <>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Continue Picking
                        </>
                      )}
                      {batch.status === 'picked' && (
                        <>
                          <Package className="h-4 w-4 mr-2" />
                          Start Packing
                        </>
                      )}
                      {batch.status === 'packing' && (
                        <>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Continue Packing
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Create New Batch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create New Bulk Pick
          </CardTitle>
          <CardDescription>
            Select orders by delivery date to create a bulk picking batch
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No orders available for bulk picking</p>
              <p className="text-sm">Confirmed orders will appear here</p>
            </div>
          ) : (
            <Tabs defaultValue={dates[0]} onValueChange={(v) => setSelectedDate(v)}>
              <TabsList className="flex-wrap h-auto gap-1 mb-4">
                {dates.map((date) => (
                  <TabsTrigger key={date} value={date} className="text-xs">
                    {date === 'No Date' ? date : format(new Date(date), 'EEE, MMM d')}
                    <Badge variant="secondary" className="ml-2">
                      {ordersByDate[date].length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {dates.map((date) => {
                const orders = ordersByDate[date];
                const allSelected = orders.every((o) => selectedOrders.has(o.id));
                
                return (
                  <TabsContent key={date} value={date} className="space-y-4">
                    {/* Select All */}
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => handleSelectAll(date)}
                        />
                        <span className="text-sm font-medium">
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {orders.filter((o) => selectedOrders.has(o.id)).length} of {orders.length} selected
                      </span>
                    </div>
                    
                    {/* Orders */}
                    <div className="space-y-2 max-h-[400px] overflow-auto">
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                            selectedOrders.has(order.id) && 'bg-primary/5 border-primary/30'
                          )}
                        >
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={() => handleToggleOrder(order.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">#{order.orderNumber}</span>
                              {order.pickListId && (
                                <Badge variant="outline" className="text-xs">
                                  Pick list ready
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {order.customerName}
                            </p>
                          </div>
                          <Badge variant="secondary">{order.itemCount} items</Badge>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>
      
      {/* Create Button */}
      {selectedOrders.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-pb">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">
                {selectedOrders.size} orders selected
              </p>
              <p className="text-sm text-muted-foreground">
                Ready to create bulk pick batch
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => setShowCreateDialog(true)}
              className="gap-2"
            >
              <Plus className="h-5 w-5" />
              Create Batch
            </Button>
          </div>
        </div>
      )}
      
      {/* Create Confirmation Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Bulk Pick Batch?</DialogTitle>
            <DialogDescription>
              This will create a new bulk picking batch with {selectedOrders.size} orders
              for delivery on {selectedDate ? format(new Date(selectedDate), 'EEEE, MMMM d, yyyy') : 'the selected date'}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBatch} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Batch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

