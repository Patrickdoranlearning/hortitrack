'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  AlertCircle,
} from 'lucide-react';
import { usePickingWizardStore } from '@/stores/use-picking-wizard-store';

interface PrinterConfig {
  id: string;
  name: string;
  is_default: boolean;
}

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

  // Printer state
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [loadingPrinters, setLoadingPrinters] = useState(true);

  // Fetch printers on mount
  useEffect(() => {
    fetch('/api/printers')
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setPrinters(data.data);
          const defaultPrinter = data.data.find((p: PrinterConfig) => p.is_default);
          if (defaultPrinter) {
            setSelectedPrinter(defaultPrinter.id);
          } else if (data.data.length > 0) {
            setSelectedPrinter(data.data[0].id);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch printers:', err);
      })
      .finally(() => setLoadingPrinters(false));
  }, []);

  if (!pickList) {
    return null;
  }

  const totalUnits = items.reduce((sum, item) => sum + item.targetQty, 0);

  // Helper to format price for labels
  const formatPrice = (price: number | null) => {
    if (price == null) return 'Price TBC';
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const handlePrintPriceLabels = async () => {
    setPrintingType('price');
    setLoading(true);
    try {
      // Print each item using the new print-sale API
      const printPromises = items.map((item) =>
        fetch('/api/labels/print-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productTitle: item.productName || item.plantVariety,
            size: item.size,
            priceText: formatPrice(item.unitPriceExVat ?? null),
            barcode: `PLU:${item.productName || item.plantVariety}|${item.size}`.slice(0, 40),
            symbology: 'code128',
            printerId: selectedPrinter || undefined,
            copies: item.targetQty,
          }),
        })
      );

      const results = await Promise.all(printPromises);
      const failedResults = results.filter((r) => !r.ok);

      if (failedResults.length > 0) {
        throw new Error(`${failedResults.length} item(s) failed to print`);
      }

      setPriceLabelsPrinted(true);
      toast({
        title: 'Labels Sent',
        description: `Price labels for ${items.length} items sent to printer.`,
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
      // Print plant labels with batch/lot info
      const printPromises = items.map((item) =>
        fetch('/api/labels/print-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productTitle: item.productName || item.plantVariety,
            size: item.size,
            priceText: formatPrice(item.unitPriceExVat ?? null),
            barcode: `PLU:${item.productName || item.plantVariety}|${item.size}`.slice(0, 40),
            symbology: 'code128',
            lotNumber: item.originalBatchNumber || item.pickedBatchNumber,
            printerId: selectedPrinter || undefined,
            copies: item.targetQty,
          }),
        })
      );

      const results = await Promise.all(printPromises);
      const failedResults = results.filter((r) => !r.ok);

      if (failedResults.length > 0) {
        throw new Error(`${failedResults.length} item(s) failed to print`);
      }

      setPlantLabelsPrinted(true);
      toast({
        title: 'Labels Sent',
        description: `Plant labels for ${items.length} items sent to printer.`,
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
          {/* Printer Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Printer</label>
            {loadingPrinters ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading printers...
              </div>
            ) : printers.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">No printers configured. Add a printer in Settings.</span>
              </div>
            ) : (
              <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a printer" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      {printer.name}
                      {printer.is_default && ' (Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

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
              disabled={isLoading || !selectedPrinter}
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
              disabled={isLoading || !selectedPrinter}
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
          <CardDescription>How your labels will look when printed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[400px] overflow-auto">
            {items.map((item) => (
              <div key={item.id} className="space-y-2">
                {/* Visual Label Mockup */}
                <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 bg-white">
                  {/* Quantity badge */}
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                    ×{item.targetQty}
                  </div>

                  {/* Label content */}
                  <div className="space-y-3">
                    {/* Product name - large */}
                    <div className="text-center">
                      <p className="font-bold text-lg leading-tight">
                        {item.productName || item.plantVariety}
                      </p>
                      <p className="text-sm text-muted-foreground">{item.size}</p>
                    </div>

                    {/* Price - prominent */}
                    <div className="text-center">
                      <span className="text-2xl font-bold text-primary">
                        {formatPrice(item.unitPriceExVat ?? null)}
                      </span>
                    </div>

                    {/* Barcode mockup */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-end justify-center gap-[1px] h-10">
                        {/* Generate barcode-like lines */}
                        {Array.from({ length: 40 }).map((_, i) => (
                          <div
                            key={i}
                            className="bg-black"
                            style={{
                              width: i % 3 === 0 ? '2px' : '1px',
                              height: `${20 + (i % 5) * 4}px`,
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        PLU:{(item.productName || item.plantVariety || '').slice(0, 15)}|{item.size}
                      </p>
                    </div>

                    {/* Batch number (for plant labels) */}
                    {(item.originalBatchNumber || item.pickedBatchNumber) && (
                      <div className="text-center pt-1 border-t border-dashed">
                        <p className="text-xs text-muted-foreground">
                          Batch: <span className="font-mono font-medium">{item.originalBatchNumber || item.pickedBatchNumber}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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

