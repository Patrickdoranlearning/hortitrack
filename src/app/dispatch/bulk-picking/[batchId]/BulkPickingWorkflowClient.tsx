'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ShoppingCart,
  Layers,
  Plus,
  Minus,
  PartyPopper,
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
type PackingStep = 'items' | 'qc' | 'trolley' | 'complete';

const TROLLEY_TYPES = [
  { value: 'tag6', label: 'Tag 6 (Yellow)' },
  { value: 'dc', label: 'DC (No Tag)' },
  { value: 'danish', label: 'Danish Trolley' },
  { value: 'dutch', label: 'Dutch Trolley' },
  { value: 'pallet', label: 'Pallet' },
];

const QC_ITEMS = [
  { key: 'quantitiesCorrect', label: 'Quantities Correct' },
  { key: 'varietiesCorrect', label: 'Varieties Correct' },
  { key: 'qualityAcceptable', label: 'Quality Acceptable' },
  { key: 'labelsAttached', label: 'Labels Attached' },
];

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
  
  // Packing workflow state
  const [packingOrder, setPackingOrder] = useState<BulkOrder | null>(null);
  const [packingStep, setPackingStep] = useState<PackingStep>('items');
  const [qcChecklist, setQcChecklist] = useState<Record<string, boolean>>({
    quantitiesCorrect: false,
    varietiesCorrect: false,
    qualityAcceptable: false,
    labelsAttached: false,
  });
  const [qcNotes, setQcNotes] = useState('');
  const [trolleyType, setTrolleyType] = useState('danish');
  const [trolleyCount, setTrolleyCount] = useState(1);
  const [shelves, setShelves] = useState(0);
  const [packingComplete, setPackingComplete] = useState(false);
  
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
  
  const handlePackOrder = (order: BulkOrder) => {
    // Show inline packing workflow
    setPackingOrder(order);
    setPackingStep('items');
    setPackingComplete(false);
    setQcChecklist({
      quantitiesCorrect: false,
      varietiesCorrect: false,
      qualityAcceptable: false,
      labelsAttached: false,
    });
    setQcNotes('');
    setTrolleyType('danish');
    setTrolleyCount(1);
    setShelves(0);
  };
  
  const handleCancelPacking = () => {
    setPackingOrder(null);
    setPackingStep('items');
  };
  
  const handleCompletePacking = async () => {
    if (!packingOrder) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/bulk-picking/${batch.id}/orders/${packingOrder.orderId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete_packing',
            trolleyInfo: { trolleyType, count: trolleyCount, shelves },
            qcChecklist,
            qcNotes,
          }),
        }
      );
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete packing');
      }
      
      // Update local state
      setBatch((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.orderId === packingOrder.orderId
            ? { ...o, packingStatus: 'packed' as const, packedAt: new Date().toISOString() }
            : o
        ),
      }));
      
      setPackingComplete(true);
      toast({
        title: 'Order Packed',
        description: `Order #${packingOrder.orderNumber} is ready for dispatch`,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFinishAndNext = () => {
    setPackingOrder(null);
    setPackingStep('items');
    setPackingComplete(false);
  };
  
  const allQcChecked = Object.values(qcChecklist).every(Boolean);
  
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
          {/* Inline Packing Workflow */}
          {packingOrder ? (
            packingComplete ? (
              // Packing Complete Screen
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
                    <PartyPopper className="h-10 w-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-700">Order Packed!</h2>
                  <p className="text-muted-foreground mt-2">
                    Order #{packingOrder.orderNumber} is ready for dispatch
                  </p>
                </div>
                
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="py-6">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-3xl font-bold text-green-700">{trolleyCount}</p>
                        <p className="text-sm text-green-600">Trolleys</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-green-700">{shelves}</p>
                        <p className="text-sm text-green-600">Shelves</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Button
                  onClick={handleFinishAndNext}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Pack Next Order
                </Button>
              </div>
            ) : (
              // Packing Workflow Steps
              <div className="space-y-4">
                {/* Packing Header */}
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={handleCancelPacking}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold">Pack #{packingOrder.orderNumber}</h2>
                    <p className="text-sm text-muted-foreground">{packingOrder.customerName}</p>
                  </div>
                </div>
                
                {/* Step Indicators */}
                <div className="flex items-center justify-between px-4">
                  {['items', 'qc', 'trolley'].map((s, i) => (
                    <div
                      key={s}
                      className={cn(
                        'flex flex-col items-center',
                        packingStep === s && 'text-primary',
                        ['items', 'qc', 'trolley'].indexOf(packingStep) > i && 'text-green-600'
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border',
                          packingStep === s && 'bg-primary text-primary-foreground border-primary',
                          ['items', 'qc', 'trolley'].indexOf(packingStep) > i &&
                            'bg-green-100 text-green-600 border-green-300'
                        )}
                      >
                        {['items', 'qc', 'trolley'].indexOf(packingStep) > i ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className="text-xs mt-1 capitalize">{s === 'qc' ? 'QC' : s}</span>
                    </div>
                  ))}
                </div>
                
                {/* Items Step */}
                {packingStep === 'items' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Confirm Items
                      </CardTitle>
                      <CardDescription>
                        Verify all items are ready for this order
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Ensure all items from the bulk pick are allocated to this order.
                      </p>
                      {packingOrder.notes && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm font-medium text-yellow-800">Order Notes:</p>
                          <p className="text-sm text-yellow-700">{packingOrder.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {/* QC Step */}
                {packingStep === 'qc' && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">QC Checklist</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {QC_ITEMS.map((item) => (
                          <div
                            key={item.key}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                              qcChecklist[item.key] && 'bg-green-50 border-green-200'
                            )}
                            onClick={() =>
                              setQcChecklist((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                            }
                          >
                            <Checkbox
                              checked={qcChecklist[item.key]}
                              onCheckedChange={(checked) =>
                                setQcChecklist((prev) => ({ ...prev, [item.key]: !!checked }))
                              }
                            />
                            <Label className="flex-1 cursor-pointer">{item.label}</Label>
                            {qcChecklist[item.key] && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={qcNotes}
                          onChange={(e) => setQcNotes(e.target.value)}
                          placeholder="Any notes about this order..."
                          rows={3}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}
                
                {/* Trolley Step */}
                {packingStep === 'trolley' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Trolley Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Trolley Type</Label>
                        <Select value={trolleyType} onValueChange={setTrolleyType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TROLLEY_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Number of Trolleys</Label>
                        <div className="flex items-center justify-center gap-4">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setTrolleyCount(Math.max(1, trolleyCount - 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-3xl font-bold w-16 text-center">
                            {trolleyCount}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setTrolleyCount(trolleyCount + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          Shelves Used
                        </Label>
                        <div className="flex items-center justify-center gap-4">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShelves(Math.max(0, shelves - 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-2xl font-bold w-12 text-center">
                            {shelves}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShelves(Math.min(10, shelves + 1))}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Navigation Buttons */}
                <div className="flex gap-3 pt-4">
                  {packingStep !== 'items' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const steps: PackingStep[] = ['items', 'qc', 'trolley'];
                        const idx = steps.indexOf(packingStep);
                        if (idx > 0) setPackingStep(steps[idx - 1]);
                      }}
                      className="flex-1"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  )}
                  
                  {packingStep === 'items' && (
                    <Button onClick={() => setPackingStep('qc')} className="flex-1">
                      Continue to QC
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                  
                  {packingStep === 'qc' && (
                    <Button
                      onClick={() => setPackingStep('trolley')}
                      disabled={!allQcChecked}
                      className={cn('flex-1', allQcChecked && 'bg-green-600 hover:bg-green-700')}
                    >
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                  
                  {packingStep === 'trolley' && (
                    <Button
                      onClick={handleCompletePacking}
                      disabled={trolleyCount < 1 || isLoading}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Complete Order
                    </Button>
                  )}
                </div>
              </div>
            )
          ) : (
            // Order Selection View
            <>
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
                            onClick={() => handlePackOrder(order)}
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
            </>
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



