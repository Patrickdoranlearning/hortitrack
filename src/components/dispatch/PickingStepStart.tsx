'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Calendar,
  Package,
  MapPin,
  FileText,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { usePickingWizardStore } from '@/stores/use-picking-wizard-store';

export default function PickingStepStart() {
  const { pickList, items, nextStep, setLoading, isLoading } = usePickingWizardStore();

  if (!pickList) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading order details...
        </CardContent>
      </Card>
    );
  }

  const totalUnits = items.reduce((sum, item) => sum + item.targetQty, 0);
  const uniqueProducts = new Set(items.map((item) => item.productName || item.plantVariety)).size;

  const handleStart = async () => {
    setLoading(true);
    try {
      // Start the pick list if not already started
      if (pickList.status === 'pending') {
        await fetch(`/api/picking/${pickList.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        });
      }
      nextStep();
    } catch (error) {
      console.error('Error starting pick list:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Order Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Order Summary
          </CardTitle>
          <CardDescription>Review order details before starting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer Info */}
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">{pickList.customerName}</p>
              <p className="text-sm text-muted-foreground">Customer</p>
            </div>
          </div>

          {/* Delivery Date */}
          {pickList.requestedDeliveryDate && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">
                  {format(new Date(pickList.requestedDeliveryDate), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">Requested Delivery</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Order Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{items.length}</p>
              <p className="text-xs text-muted-foreground">Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totalUnits}</p>
              <p className="text-xs text-muted-foreground">Units</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{uniqueProducts}</p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
          </div>

          {/* Notes */}
          {pickList.notes && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Order Notes</p>
                  <p className="text-sm text-muted-foreground">{pickList.notes}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Items Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Items to Pick</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {item.productName || item.plantVariety || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.size}
                    {item.batchLocation && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.batchLocation}
                      </span>
                    )}
                  </p>
                </div>
                <Badge variant="outline" className="ml-2">
                  ×{item.targetQty}
                </Badge>
              </div>
            ))}
            {items.length > 5 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                +{items.length - 5} more items
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Start Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-pb">
        <Button
          size="lg"
          className="w-full gap-2"
          onClick={handleStart}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Clock className="h-5 w-5 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              Start Picking
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}





