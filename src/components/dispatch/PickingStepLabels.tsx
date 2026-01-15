'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Printer,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Tag,
  Package,
  SkipForward,
  Loader2,
} from 'lucide-react';
import { usePickingWizardStore } from '@/stores/use-picking-wizard-store';

export default function PickingStepLabels() {
  const { toast } = useToast();
  const {
    pickList,
    items,
    setLabelsPrinted,
    nextStep,
    prevStep,
    isLoading,
    setLoading,
  } = usePickingWizardStore();

  const [printingType, setPrintingType] = useState<'price' | 'labels' | null>(null);
  const [priceLabelsPrinted, setPriceLabelsPrinted] = useState(false);
  const [plantLabelsPrinted, setPlantLabelsPrinted] = useState(false);

  if (!pickList) {
    return null;
  }

  const totalUnits = items.reduce((sum, item) => sum + item.targetQty, 0);

  const handlePrintPriceLabels = async () => {
    setPrintingType('price');
    setLoading(true);
    try {
      // Call the existing label printing API
      const res = await fetch(`/api/sales/orders/${pickList.orderId}/labels/print`, {
        method: 'POST',
      });
      
      const data = await res.json();
      if (!res.ok) {
        const errorMessage = typeof data.error === 'object'
          ? data.error?.message || JSON.stringify(data.error)
          : data.error || 'Failed to print labels';
        throw new Error(errorMessage);
      }

      setPriceLabelsPrinted(true);
      toast({
        title: 'Labels Sent',
        description: 'Price labels have been sent to the printer.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Print Error',
        description: error instanceof Error ? error.message : 'Failed to print price labels',
      });
    } finally {
      setLoading(false);
      setPrintingType(null);
    }
  };

  const handlePrintPlantLabels = async () => {
    setPrintingType('labels');
    setLoading(true);
    try {
      // Print plant/batch labels - this might be a different endpoint
      // For now, we'll use the same endpoint or skip if not implemented
      const res = await fetch(`/api/sales/orders/${pickList.orderId}/labels/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'plant' }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        const errorMessage = typeof data.error === 'object'
          ? data.error?.message || JSON.stringify(data.error)
          : data.error || 'Failed to print labels';
        throw new Error(errorMessage);
      }

      setPlantLabelsPrinted(true);
      toast({
        title: 'Labels Sent',
        description: 'Plant labels have been sent to the printer.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Print Error',
        description: error instanceof Error ? error.message : 'Failed to print plant labels',
      });
    } finally {
      setLoading(false);
      setPrintingType(null);
    }
  };

  const handleSkip = () => {
    setLabelsPrinted(false);
    nextStep();
  };

  const handleContinue = () => {
    setLabelsPrinted(priceLabelsPrinted || plantLabelsPrinted);
    nextStep();
  };

  const canContinue = priceLabelsPrinted || plantLabelsPrinted;

  return (
    <div className="space-y-4">
      {/* Print Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Print Labels
          </CardTitle>
          <CardDescription>
            Print price tags and plant labels for this order
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">Total labels needed</span>
            </div>
            <Badge variant="secondary">{totalUnits} labels</Badge>
          </div>

          {/* Price Labels */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                priceLabelsPrinted ? 'bg-green-100' : 'bg-muted'
              }`}>
                {priceLabelsPrinted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Tag className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium">Price Labels</p>
                <p className="text-sm text-muted-foreground">
                  Customer-facing price tags
                </p>
              </div>
            </div>
            <Button
              variant={priceLabelsPrinted ? 'outline' : 'default'}
              onClick={handlePrintPriceLabels}
              disabled={isLoading}
            >
              {printingType === 'price' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : priceLabelsPrinted ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              {priceLabelsPrinted ? 'Reprint' : 'Print'}
            </Button>
          </div>

          {/* Plant Labels */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                plantLabelsPrinted ? 'bg-green-100' : 'bg-muted'
              }`}>
                {plantLabelsPrinted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium">Plant Labels</p>
                <p className="text-sm text-muted-foreground">
                  Batch identification labels
                </p>
              </div>
            </div>
            <Button
              variant={plantLabelsPrinted ? 'outline' : 'default'}
              onClick={handlePrintPlantLabels}
              disabled={isLoading}
            >
              {printingType === 'labels' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : plantLabelsPrinted ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              {plantLabelsPrinted ? 'Reprint' : 'Print'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Label Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Label Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[200px] overflow-auto">
            {items.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.productName || item.plantVariety}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.size}</p>
                </div>
                <Badge variant="outline" className="ml-2 text-xs">
                  ×{item.targetQty}
                </Badge>
              </div>
            ))}
            {items.length > 4 && (
              <p className="text-xs text-muted-foreground text-center py-1">
                +{items.length - 4} more items
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-pb">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={prevStep}
            className="flex-1"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {canContinue ? (
            <Button
              onClick={handleContinue}
              className="flex-1"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={handleSkip}
              className="flex-1"
            >
              <SkipForward className="h-4 w-4 mr-2" />
              Skip Printing
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

