'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  ShoppingCart,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  User,
  Layers,
  Plus,
  Minus,
  Loader2,
  PartyPopper,
  Scan,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ScannerClient from '@/components/Scanner/ScannerClient';

interface PackingItem {
  id: string;
  skuId: string;
  productName: string;
  size: string;
  orderedQty: number;
  availableQty: number;
  packedQty: number;
  status: 'pending' | 'packed' | 'short';
}

interface PackingOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  notes?: string;
  batchId?: string;
  batchNumber?: string;
  items: PackingItem[];
}

interface PackableOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  pickListId?: string;
}

interface PackingStationClientProps {
  mode: 'queue' | 'bulk';
  order?: PackingOrder;
  packableOrders?: PackableOrder[];
}

type Step = 'items' | 'qc' | 'trolley' | 'complete';

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

export default function PackingStationClient({
  mode,
  order: initialOrder,
  packableOrders,
}: PackingStationClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [order] = useState<PackingOrder | null>(initialOrder || null);
  const [items, setItems] = useState<PackingItem[]>(initialOrder?.items || []);
  const [step, setStep] = useState<Step>('items');
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  // QC State
  const [qcChecklist, setQcChecklist] = useState<Record<string, boolean>>({
    quantitiesCorrect: false,
    varietiesCorrect: false,
    qualityAcceptable: false,
    labelsAttached: false,
  });
  const [qcNotes, setQcNotes] = useState('');
  
  // Trolley State
  const [trolleyType, setTrolleyType] = useState('tag6');
  const [trolleyCount, setTrolleyCount] = useState(1);
  const [shelves, setShelves] = useState(0);
  
  const packedItems = items.filter((i) => i.status !== 'pending');
  const pendingItems = items.filter((i) => i.status === 'pending');
  const progress = items.length > 0
    ? Math.round((packedItems.length / items.length) * 100)
    : 0;
  
  const allQcChecked = Object.values(qcChecklist).every(Boolean);
  
  const handlePackItem = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, status: 'packed', packedQty: item.orderedQty }
          : item
      )
    );
  };
  
  const handleShortItem = (itemId: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, status: 'short', packedQty: qty }
          : item
      )
    );
  };
  
  const handleScan = (text: string) => {
    // Match scanned text to an item and pack it
    const item = items.find(
      (i) =>
        i.status === 'pending' &&
        (i.productName.toLowerCase().includes(text.toLowerCase()) ||
          text.includes(i.skuId))
    );
    
    if (item) {
      handlePackItem(item.id);
      toast({
        title: 'Item Packed',
        description: `${item.productName} - ${item.size}`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Not Found',
        description: 'Scanned item not found in this order',
      });
    }
    
    setShowScanner(false);
  };
  
  const handleCompleteOrder = async () => {
    if (!order) return;
    
    setIsLoading(true);
    try {
      const trolleyInfo = {
        trolleyType,
        count: trolleyCount,
        shelves,
      };
      
      if (order.batchId) {
        // Bulk packing - update bulk batch order
        const res = await fetch(
          `/api/bulk-picking/${order.batchId}/orders/${order.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'complete_packing',
              trolleyInfo,
              qcChecklist,
              qcNotes,
            }),
          }
        );
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to complete');
        }
      } else {
        // Standard packing
        const res = await fetch(`/api/dispatch/packing/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            trolleysUsed: trolleyCount,
            trolleyType,
            shelves,
            qcChecklist,
            qcNotes,
          }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to complete');
        }
      }
      
      setIsComplete(true);
      toast({
        title: 'Order Complete',
        description: `Order #${order.orderNumber} is ready for dispatch`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to complete order',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBack = () => {
    if (order?.batchId) {
      router.push(`/dispatch/bulk-picking/${order.batchId}`);
    } else {
      router.push('/dispatch/packing');
    }
  };
  
  const handleDone = () => {
    if (order?.batchId) {
      router.push(`/dispatch/bulk-picking/${order.batchId}`);
    } else {
      router.push('/dispatch/picking');
    }
  };
  
  // Queue Mode - Show list of orders to pack
  if (mode === 'queue' && !order) {
    return (
      <div className="space-y-4">
        {(!packableOrders || packableOrders.length === 0) ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No orders ready for packing</p>
              <p className="text-sm text-muted-foreground">
                Complete picking to see orders here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packableOrders.map((o) => (
              <Card
                key={o.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => router.push(`/dispatch/packing?order=${o.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">#{o.orderNumber}</p>
                    <Badge variant="outline">{o.itemCount} items</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {o.customerName}
                  </p>
                  <Button className="w-full mt-3" size="sm">
                    <Package className="h-4 w-4 mr-2" />
                    Start Packing
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Completion Screen
  if (isComplete && order) {
    return (
      <div className="space-y-6 py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <PartyPopper className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-700">Order Packed!</h2>
          <p className="text-muted-foreground mt-2">
            Order #{order.orderNumber} is ready for dispatch
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
                <p className="text-3xl font-bold text-green-700">
                  {items.reduce((sum, i) => sum + i.packedQty, 0)}
                </p>
                <p className="text-sm text-green-600">Units Packed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Button
          onClick={handleDone}
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
        >
          <CheckCircle2 className="h-5 w-5 mr-2" />
          Done
        </Button>
      </div>
    );
  }
  
  if (!order) return null;
  
  // Packing Workflow
  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Pack Order #{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">{order.customerName}</p>
        </div>
        {order.batchNumber && (
          <Badge variant="outline">{order.batchNumber}</Badge>
        )}
      </div>
      
      {/* Steps */}
      <div className="flex items-center justify-between px-4">
        {['items', 'qc', 'trolley', 'complete'].map((s, i) => (
          <div
            key={s}
            className={cn(
              'flex flex-col items-center',
              step === s && 'text-primary',
              ['items', 'qc', 'trolley', 'complete'].indexOf(step) > i && 'text-green-600'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                step === s && 'bg-primary text-primary-foreground',
                ['items', 'qc', 'trolley', 'complete'].indexOf(step) > i &&
                  'bg-green-100 text-green-600'
              )}
            >
              {['items', 'qc', 'trolley', 'complete'].indexOf(step) > i ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            <span className="text-xs mt-1 capitalize">{s}</span>
          </div>
        ))}
      </div>
      
      {/* Step Content */}
      {step === 'items' && (
        <>
          <Card>
            <CardContent className="py-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">
                  {packedItems.length}/{items.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>
          
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowScanner(true)}
          >
            <Scan className="h-4 w-4 mr-2" />
            Scan Item
          </Button>
          
          <div className="space-y-3">
            {pendingItems.length > 0 && (
              <>
                <h3 className="font-semibold">Items to Pack</h3>
                {pendingItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-muted-foreground">{item.size}</p>
                        </div>
                        <Badge variant="outline">×{item.orderedQty}</Badge>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handlePackItem(item.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Pack
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleShortItem(item.id, 0)}
                        >
                          Short
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
            
            {packedItems.length > 0 && (
              <>
                <h3 className="font-semibold text-green-600 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Packed
                </h3>
                {packedItems.map((item) => (
                  <Card key={item.id} className="opacity-75">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">{item.productName}</span>
                        </div>
                        <Badge variant="secondary">
                          {item.packedQty}/{item.orderedQty}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </>
      )}
      
      {step === 'qc' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>QC Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {QC_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border',
                    qcChecklist[item.key] && 'bg-green-50 border-green-200'
                  )}
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
      
      {step === 'trolley' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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
        </div>
      )}
      
      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-pb">
        <div className="flex gap-3">
          {step !== 'items' && (
            <Button
              variant="outline"
              onClick={() => {
                const steps: Step[] = ['items', 'qc', 'trolley', 'complete'];
                const idx = steps.indexOf(step);
                if (idx > 0) setStep(steps[idx - 1]);
              }}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          
          {step === 'items' && (
            <Button
              onClick={() => setStep('qc')}
              disabled={pendingItems.length > 0}
              className={cn(
                'flex-1',
                pendingItems.length === 0 && 'bg-green-600 hover:bg-green-700'
              )}
            >
              Continue to QC
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          
          {step === 'qc' && (
            <Button
              onClick={() => setStep('trolley')}
              disabled={!allQcChecked}
              className={cn('flex-1', allQcChecked && 'bg-green-600 hover:bg-green-700')}
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          
          {step === 'trolley' && (
            <Button
              onClick={handleCompleteOrder}
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
      
      {/* Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Item</DialogTitle>
            <DialogDescription>Scan item label to pack</DialogDescription>
          </DialogHeader>
          {showScanner && <ScannerClient onDecoded={handleScan} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

