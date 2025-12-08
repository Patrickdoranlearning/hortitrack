'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Keyboard,
  RefreshCw,
  X,
  Play,
  Loader2,
  Boxes,
  User,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ScannerClient from '@/components/Scanner/ScannerClient';

interface BulkPickItem {
  id: string;
  skuId: string;
  skuCode?: string;
  productName: string;
  size: string;
  totalQty: number;
  pickedQty: number;
  status: 'pending' | 'picked' | 'short' | 'substituted';
  pickedBatchId?: string;
  substituteBatchId?: string;
  substitutionReason?: string;
  locationHint?: string;
}

interface BulkOrder {
  id: string;
  orderId: string;
  pickListId?: string;
  packingStatus: 'pending' | 'in_progress' | 'packed';
  packedAt?: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  deliveryDate?: string;
  notes?: string;
}

interface BulkBatch {
  id: string;
  batchNumber: string;
  batchDate: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  orders: BulkOrder[];
  items: BulkPickItem[];
}

interface BulkPickingWorkflowClientProps {
  batch: BulkBatch;
}

type WorkflowPhase = 'picking' | 'packing';

export default function BulkPickingWorkflowClient({ batch: initialBatch }: BulkPickingWorkflowClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [batch, setBatch] = useState(initialBatch);
  const [items, setItems] = useState<BulkPickItem[]>(initialBatch.items);
  const [phase, setPhase] = useState<WorkflowPhase>(
    batch.status === 'packing' || batch.status === 'picked' ? 'packing' : 'picking'
  );
  const [showScanner, setShowScanner] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BulkPickItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const pendingItems = items.filter((i) => i.status === 'pending');
  const completedItems = items.filter((i) => i.status !== 'pending');
  const progress = items.length > 0
    ? Math.round((completedItems.length / items.length) * 100)
    : 0;
  
  const pendingOrders = batch.orders.filter((o) => o.packingStatus === 'pending');
  const packedOrders = batch.orders.filter((o) => o.packingStatus === 'packed');
  const packingProgress = batch.orders.length > 0
    ? Math.round((packedOrders.length / batch.orders.length) * 100)
    : 0;
  
  const handleStartPicking = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bulk-picking/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start');
      }
      
      setBatch((prev) => ({ ...prev, status: 'in_progress' }));
      toast({ title: 'Picking Started', description: 'Begin picking items' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePickItem = async (item: BulkPickItem, qty?: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bulk-picking/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pick_item',
          itemId: item.id,
          pickedQty: qty || item.totalQty,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to pick item');
      }
      
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'picked', pickedQty: qty || item.totalQty }
            : i
        )
      );
      
      toast({
        title: 'Item Picked',
        description: `${item.productName} - ${qty || item.totalQty} units`,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleShortItem = async (item: BulkPickItem, pickedQty: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bulk-picking/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'short_item',
          itemId: item.id,
          pickedQty,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to mark short');
      }
      
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: 'short', pickedQty } : i
        )
      );
      
      toast({
        variant: 'destructive',
        title: 'Marked Short',
        description: `${item.productName} - only ${pickedQty} available`,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCompletePicking = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bulk-picking/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_picking' }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete');
      }
      
      setBatch((prev) => ({ ...prev, status: 'picked' }));
      setPhase('packing');
      toast({
        title: 'Picking Complete',
        description: 'Move to packing station to break down orders',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStartPacking = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bulk-picking/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_packing' }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start packing');
      }
      
      setBatch((prev) => ({ ...prev, status: 'packing' }));
      toast({ title: 'Packing Started', description: 'Begin packing orders' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePackOrder = (orderId: string) => {
    // Navigate to the packing station for this order
    router.push(`/dispatch/packing?batch=${batch.id}&order=${orderId}`);
  };
  
  const handleScan = useCallback((scannedText: string) => {
    // Handle scanned batch code
    toast({
      title: 'Scanned',
      description: scannedText,
    });
    setShowScanner(false);
    // Match with item and pick it
  }, [toast]);
  
  const handleExit = () => {
    router.push('/dispatch/bulk-picking');
  };
  
  const canCompletePicking = pendingItems.length === 0;
  
  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleExit}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">{batch.batchNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(batch.batchDate), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Badge className={cn(
          batch.status === 'pending' && 'bg-slate-100 text-slate-700',
          batch.status === 'in_progress' && 'bg-blue-100 text-blue-700',
          batch.status === 'picked' && 'bg-amber-100 text-amber-700',
          batch.status === 'packing' && 'bg-purple-100 text-purple-700',
        )}>
          {batch.status.replace('_', ' ')}
        </Badge>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">{batch.orders.length}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">{items.length}</p>
            <p className="text-xs text-muted-foreground">Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">
              {items.reduce((sum, i) => sum + i.totalQty, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Units</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Phase Tabs */}
      <Tabs value={phase} onValueChange={(v) => setPhase(v as WorkflowPhase)}>
        <TabsList className="w-full">
          <TabsTrigger value="picking" className="flex-1">
            <Package className="h-4 w-4 mr-2" />
            Picking
          </TabsTrigger>
          <TabsTrigger value="packing" className="flex-1" disabled={batch.status === 'pending' || batch.status === 'in_progress'}>
            <Boxes className="h-4 w-4 mr-2" />
            Packing
          </TabsTrigger>
        </TabsList>
        
        {/* Picking Phase */}
        <TabsContent value="picking" className="space-y-4 mt-4">
          {/* Progress */}
          <Card>
            <CardContent className="py-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Picking Progress</span>
                <span className="text-sm text-muted-foreground">
                  {completedItems.length}/{items.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>
          
          {/* Start Button */}
          {batch.status === 'pending' && (
            <Button
              size="lg"
              className="w-full"
              onClick={handleStartPicking}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              Start Bulk Picking
            </Button>
          )}
          
          {/* Items List */}
          {(batch.status === 'in_progress' || batch.status === 'picked') && (
            <>
              {/* Pending Items */}
              {pendingItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Items to Pick
                    <Badge variant="secondary">{pendingItems.length}</Badge>
                  </h3>
                  
                  {pendingItems.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-sm text-muted-foreground">{item.size}</p>
                            {item.locationHint && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {item.locationHint}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-lg px-3 py-1">
                            ×{item.totalQty}
                          </Badge>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            onClick={() => handlePickItem(item)}
                            disabled={isLoading}
                            className="flex-1"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Pick All
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleShortItem(item, 0)}
                            disabled={isLoading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Completed Items */}
              {completedItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    Picked
                    <Badge variant="outline" className="text-green-600">
                      {completedItems.length}
                    </Badge>
                  </h3>
                  
                  {completedItems.map((item) => (
                    <Card
                      key={item.id}
                      className={cn(
                        'opacity-75',
                        item.status === 'short' && 'border-red-200 bg-red-50'
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.status === 'short' ? (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">{item.size}</p>
                            </div>
                          </div>
                          <Badge variant={item.status === 'short' ? 'destructive' : 'secondary'}>
                            {item.pickedQty}/{item.totalQty}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
        
        {/* Packing Phase */}
        <TabsContent value="packing" className="space-y-4 mt-4">
          {/* Progress */}
          <Card>
            <CardContent className="py-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Packing Progress</span>
                <span className="text-sm text-muted-foreground">
                  {packedOrders.length}/{batch.orders.length}
                </span>
              </div>
              <Progress value={packingProgress} className="h-2" />
            </CardContent>
          </Card>
          
          {batch.status === 'picked' && (
            <Button
              size="lg"
              className="w-full"
              onClick={handleStartPacking}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              Start Packing Orders
            </Button>
          )}
          
          {/* Orders to Pack */}
          {(batch.status === 'packing' || batch.status === 'completed') && (
            <div className="space-y-3">
              <h3 className="font-semibold">Orders to Pack</h3>
              
              {batch.orders.map((order) => (
                <Card
                  key={order.id}
                  className={cn(
                    order.packingStatus === 'packed' && 'opacity-75 border-green-200'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">#{order.orderNumber}</p>
                          {order.packingStatus === 'packed' && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {order.customerName}
                        </p>
                      </div>
                      <Badge
                        variant={
                          order.packingStatus === 'packed'
                            ? 'default'
                            : order.packingStatus === 'in_progress'
                            ? 'secondary'
                            : 'outline'
                        }
                        className={order.packingStatus === 'packed' ? 'bg-green-600' : ''}
                      >
                        {order.packingStatus === 'packed'
                          ? 'Packed'
                          : order.packingStatus === 'in_progress'
                          ? 'In Progress'
                          : 'Pending'}
                      </Badge>
                    </div>
                    
                    {order.packingStatus !== 'packed' && (
                      <Button
                        className="w-full mt-3"
                        size="sm"
                        onClick={() => handlePackOrder(order.orderId)}
                      >
                        <Package className="h-4 w-4 mr-2" />
                        {order.packingStatus === 'in_progress' ? 'Continue' : 'Start'} Packing
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Bottom Action Bar */}
      {phase === 'picking' && batch.status === 'in_progress' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-pb">
          <Button
            size="lg"
            className={cn(
              'w-full',
              canCompletePicking && 'bg-green-600 hover:bg-green-700'
            )}
            onClick={handleCompletePicking}
            disabled={!canCompletePicking || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-5 w-5 mr-2" />
            )}
            Complete Picking
          </Button>
        </div>
      )}
      
      {/* Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Batch</DialogTitle>
            <DialogDescription>
              Scan the batch label to confirm picking
            </DialogDescription>
          </DialogHeader>
          {showScanner && <ScannerClient onDecoded={handleScan} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

