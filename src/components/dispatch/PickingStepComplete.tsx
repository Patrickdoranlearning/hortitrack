'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  Package,
  User,
  Calendar,
  ShoppingCart,
  Layers,
  AlertTriangle,
  Loader2,
  PartyPopper,
  Printer,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { usePickingWizardStore } from '@/stores/use-picking-wizard-store';

interface PickingStepCompleteProps {
  onComplete?: () => void;
}

export default function PickingStepComplete({ onComplete }: PickingStepCompleteProps) {
  const { toast } = useToast();
  const {
    pickList,
    items,
    qcChecklist,
    qcNotes,
    trolleyInfo,
    prevStep,
    reset,
    setLoading,
  } = usePickingWizardStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  if (!pickList) {
    return null;
  }

  const totalUnits = items.reduce((sum, item) => sum + item.targetQty, 0);
  const pickedUnits = items.reduce((sum, item) => sum + item.pickedQty, 0);
  const shortItems = items.filter((item) => item.status === 'short');
  const substitutedItems = items.filter((item) => item.status === 'substituted');

  const TROLLEY_TYPE_LABELS: Record<string, string> = {
    tag6: 'Tag 6 (Yellow)',
    dc: 'DC (No Tag)',
    danish: 'Danish Trolley',
    dutch: 'Dutch Trolley',
    pallet: 'Pallet',
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setLoading(true);

    try {
      // Complete the pick list
      const res = await fetch(`/api/picking/${pickList.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          qcChecklist,
          qcNotes,
          trolleyInfo,
        }),
      });

      const data = await res.json();

      if (data.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error,
        });
        return;
      }

      // Update packing record with trolley info
      const packingRes = await fetch(`/api/dispatch/packing/${pickList.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          trolleysUsed: trolleyInfo.count,
          trolleyType: trolleyInfo.trolleyType,
          shelves: trolleyInfo.shelves,
          totalUnits: pickedUnits,
        }),
      });

      if (!packingRes.ok) {
        const packingData = await packingRes.json().catch(() => ({}));
        toast({
          variant: 'destructive',
          title: 'Warning',
          description: packingData.error || 'Failed to update packing record',
        });
        // Continue anyway since the pick list was completed successfully
      }

      setIsCompleted(true);

      toast({
        title: 'Order Complete!',
        description: `Order #${pickList.orderNumber} is ready for dispatch.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to complete order',
      });
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleDone = () => {
    reset();
    if (onComplete) {
      onComplete();
    }
  };

  const handlePrintDispatchDocs = () => {
    window.open(`/sales/orders/${pickList.orderId}/dispatch-documents`, '_blank');
  };

  if (isCompleted) {
    return (
      <div className="space-y-6 py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <PartyPopper className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-700">Order Complete!</h2>
          <p className="text-muted-foreground mt-2">
            Order #{pickList.orderNumber} is ready for dispatch
          </p>
          <p className="text-sm text-green-600 mt-1">
            Invoice has been automatically generated
          </p>
        </div>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-green-700">{pickedUnits}</p>
                <p className="text-sm text-green-600">Units Picked</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-700">{trolleyInfo.count}</p>
                <p className="text-sm text-green-600">Trolleys</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Print Dispatch Documents */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Dispatch Documents Ready</p>
                  <p className="text-sm text-muted-foreground">2 delivery dockets + 2 invoices</p>
                </div>
              </div>
              <Button 
                onClick={handlePrintDispatchDocs}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print All
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-pb">
          <Button
            onClick={handleDone}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Done - Back to Queue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold">Ready to Submit</h2>
          <p className="text-muted-foreground">Review the order summary before completing</p>
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="text-sm">Customer</span>
            </div>
            <span className="font-medium">{pickList.customerName}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span className="text-sm">Order</span>
            </div>
            <span className="font-medium">#{pickList.orderNumber}</span>
          </div>
          {pickList.requestedDeliveryDate && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Delivery</span>
              </div>
              <span className="font-medium">
                {format(new Date(pickList.requestedDeliveryDate), 'MMM d, yyyy')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Picking Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Picking Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Items Picked</span>
            <Badge variant="secondary">{items.length} items</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Units Picked</span>
            <Badge variant="secondary">
              {pickedUnits} / {totalUnits} units
            </Badge>
          </div>
          
          {shortItems.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Short Items
              </span>
              <Badge variant="destructive">{shortItems.length}</Badge>
            </div>
          )}
          
          {substitutedItems.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-600">Substituted</span>
              <Badge variant="outline">{substitutedItems.length}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trolley Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Trolley Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Type</span>
            <span className="font-medium">
              {TROLLEY_TYPE_LABELS[trolleyInfo.trolleyType] || trolleyInfo.trolleyType}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Count</span>
            <Badge variant="secondary">{trolleyInfo.count} trolleys</Badge>
          </div>
          {(trolleyInfo.shelves || 0) > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Shelves
              </span>
              <Badge variant="outline">{trolleyInfo.shelves}</Badge>
            </div>
          )}
          {trolleyInfo.trolleyNumbers && trolleyInfo.trolleyNumbers.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">Trolley Numbers</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {trolleyInfo.trolleyNumbers.filter(Boolean).map((num, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {num}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QC Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">QC Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-sm">
              All QC checks passed
              {Object.values(qcChecklist).every(Boolean)
                ? ''
                : ' (with overrides)'}
            </span>
          </div>
          {qcNotes && (
            <div className="mt-2 p-2 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground">Notes:</p>
              <p className="text-sm">{qcNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-pb">
        <div className="flex gap-3">
          <Button variant="outline" onClick={prevStep} className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Submit Order
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

