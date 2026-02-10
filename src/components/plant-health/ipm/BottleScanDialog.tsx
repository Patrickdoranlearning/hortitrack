'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  ScanLine,
  FlaskConical,
  Package,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import ScannerClient from '@/components/Scanner/ScannerClient';
import {
  getBottleByCode,
  recordUsage,
  getAvailableBottles,
  type IpmBottle,
} from '@/app/actions/ipm-stock';

type BottleScanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  locationId?: string;
  suggestedQuantityMl?: number;
  onUsageRecorded: (bottle: IpmBottle, quantityMl: number) => void;
};

export function BottleScanDialog({
  open,
  onOpenChange,
  productId,
  productName,
  locationId,
  suggestedQuantityMl,
  onUsageRecorded,
}: BottleScanDialogProps) {
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [scannedBottle, setScannedBottle] = useState<IpmBottle | null>(null);
  const [availableBottles, setAvailableBottles] = useState<IpmBottle[]>([]);
  const [quantityMl, setQuantityMl] = useState<number>(suggestedQuantityMl || 100);
  const [manualCode, setManualCode] = useState('');
  const [recording, setRecording] = useState(false);

  // Load available bottles when dialog opens
  useEffect(() => {
    if (open) {
      setScanning(true);
      setScannedBottle(null);
      setQuantityMl(suggestedQuantityMl || 100);
      setManualCode('');
      
      getAvailableBottles(productId).then((result) => {
        if (result.success && result.data) {
          setAvailableBottles(result.data);
        }
      });
    }
  }, [open, productId, suggestedQuantityMl]);

  const handleScan = async (code: string) => {
    if (loading) return;
    setLoading(true);

    // Check if this is a bottle code
    const result = await getBottleByCode(code);
    
    if (!result.success || !result.data) {
      toast.error('Bottle not found', {
        description: 'This code is not recognized as a registered bottle',
      });
      setLoading(false);
      return;
    }

    const bottle = result.data;

    // Verify it's the right product
    if (bottle.productId !== productId) {
      toast.error('Wrong product', {
        description: `This bottle contains ${bottle.product?.name}, not ${productName}`,
      });
      setLoading(false);
      return;
    }

    // Check if bottle has contents
    if (bottle.status === 'empty' || bottle.status === 'disposed') {
      toast.error('Bottle empty', {
        description: 'This bottle has been marked as empty or disposed',
      });
      setLoading(false);
      return;
    }

    setScannedBottle(bottle);
    setScanning(false);
    setLoading(false);
    toast.success('Bottle scanned', { description: bottle.bottleCode });
  };

  const handleSelectBottle = (bottleId: string) => {
    const bottle = availableBottles.find(b => b.id === bottleId);
    if (bottle) {
      setScannedBottle(bottle);
      setScanning(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScan(manualCode.trim().toUpperCase());
      setManualCode('');
    }
  };

  const handleRecordUsage = async () => {
    if (!scannedBottle) return;
    
    setRecording(true);
    const result = await recordUsage({
      bottleId: scannedBottle.id,
      quantityMl,
      locationId,
    });

    if (!result.success) {
      toast.error(result.error || 'Failed to record usage');
      setRecording(false);
      return;
    }

    toast.success('Usage recorded', {
      description: `${quantityMl}ml from ${scannedBottle.bottleCode}`,
    });

    onUsageRecorded(scannedBottle, quantityMl);
    onOpenChange(false);
  };

  const resetScan = () => {
    setScannedBottle(null);
    setScanning(true);
  };

  const percentRemaining = scannedBottle
    ? Math.round((scannedBottle.remainingMl / scannedBottle.volumeMl) * 100)
    : 0;

  const willBeEmpty = scannedBottle && quantityMl >= scannedBottle.remainingMl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Scan Bottle: {productName}
          </DialogTitle>
          <DialogDescription>
            Scan the QR code on the bottle to record usage
          </DialogDescription>
        </DialogHeader>

        {scanning && !scannedBottle ? (
          <div className="space-y-4">
            {/* Scanner */}
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <ScannerClient onDecoded={handleScan} />
              </CardContent>
            </Card>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking up bottle...
              </div>
            )}

            {/* Manual Entry */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <Input
                placeholder="Enter bottle code..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="flex-1 font-mono"
              />
              <Button type="submit" variant="secondary" disabled={!manualCode.trim()}>
                Go
              </Button>
            </form>

            {/* Or Select from Available */}
            {availableBottles.length > 0 && (
              <div className="space-y-2">
                <Label>Or select an open bottle:</Label>
                <Select onValueChange={handleSelectBottle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bottle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBottles.map((bottle) => (
                      <SelectItem key={bottle.id} value={bottle.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{bottle.bottleCode}</span>
                          <span className="text-muted-foreground">
                            ({bottle.remainingMl}ml left)
                          </span>
                          {bottle.status === 'open' && (
                            <Badge variant="secondary" className="text-xs">Open</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {availableBottles.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm">No bottles in stock for this product</p>
                <p className="text-xs mt-1">Add stock from the Products page</p>
              </div>
            )}
          </div>
        ) : scannedBottle ? (
          <div className="space-y-4">
            {/* Scanned Bottle Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-mono font-bold text-lg">
                        {scannedBottle.bottleCode}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {scannedBottle.product?.name}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetScan}>
                    <ScanLine className="h-4 w-4 mr-1" />
                    Rescan
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Remaining</span>
                    <span className="font-semibold">
                      {scannedBottle.remainingMl}ml / {scannedBottle.volumeMl}ml
                    </span>
                  </div>
                  <Progress value={percentRemaining} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{percentRemaining}% full</span>
                    <Badge variant={scannedBottle.status === 'open' ? 'default' : 'secondary'}>
                      {scannedBottle.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quantity Input */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Amount Used (ml)</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={scannedBottle.remainingMl}
                value={quantityMl}
                onChange={(e) => setQuantityMl(Number(e.target.value))}
                className="text-lg font-semibold"
              />
              {suggestedQuantityMl && (
                <p className="text-xs text-muted-foreground">
                  Suggested: {suggestedQuantityMl}ml based on rate
                </p>
              )}
              {willBeEmpty && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  This will empty the bottle
                </p>
              )}
            </div>

            {/* Quick Amounts */}
            <div className="flex flex-wrap gap-2">
              {[50, 100, 250, 500, scannedBottle.remainingMl].filter((v, i, a) => 
                v <= scannedBottle.remainingMl && a.indexOf(v) === i
              ).map((amount) => (
                <Button
                  key={amount}
                  variant={quantityMl === amount ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuantityMl(amount)}
                >
                  {amount === scannedBottle.remainingMl ? 'All' : `${amount}ml`}
                </Button>
              ))}
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleRecordUsage}
                disabled={recording || quantityMl <= 0 || quantityMl > scannedBottle.remainingMl}
              >
                {recording ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Record {quantityMl}ml
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

