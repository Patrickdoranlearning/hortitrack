'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Calculator,
  Beaker,
  FlaskConical,
  Droplets,
  AlertTriangle,
} from 'lucide-react';
import type { IpmJob } from '@/types/ipm-jobs';

type Props = {
  job: IpmJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MixInstructions({ job, open, onOpenChange }: Props) {
  const [totalVolumeLitres, setTotalVolumeLitres] = useState('10');

  const calculations = useMemo(() => {
    if (!job?.product.rate) return null;

    const volume = parseFloat(totalVolumeLitres) || 0;
    const rate = job.product.rate;
    const rateUnit = job.product.rateUnit || 'ml/L';

    // Parse rate unit to determine calculation
    let productAmount = 0;
    let unit = 'ml';

    if (rateUnit.includes('/L') || rateUnit.includes('per L') || rateUnit.includes('per litre')) {
      // Rate is per litre
      productAmount = rate * volume;
      unit = rateUnit.replace('/L', '').replace('per L', '').replace('per litre', '').trim() || 'ml';
    } else if (rateUnit.includes('/100L') || rateUnit.includes('per 100L')) {
      // Rate is per 100 litres
      productAmount = (rate * volume) / 100;
      unit = rateUnit.replace('/100L', '').replace('per 100L', '').trim() || 'ml';
    } else if (rateUnit.includes('/ha') || rateUnit.includes('per ha')) {
      // Rate is per hectare - can't calculate without area
      return null;
    } else {
      // Default to per litre
      productAmount = rate * volume;
      unit = rateUnit;
    }

    return {
      productAmount: productAmount.toFixed(1),
      unit,
      waterAmount: volume,
    };
  }, [job, totalVolumeLitres]);

  if (!job) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Mix Calculator
          </SheetTitle>
          <SheetDescription>
            Calculate the product amount for your spray mix
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Product info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {job.product.isTankMix ? (
                <Beaker className="h-4 w-4 text-purple-600" />
              ) : (
                <FlaskConical className="h-4 w-4 text-primary" />
              )}
              <span className="font-medium">{job.name}</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Rate:</span> {job.product.rate} {job.product.rateUnit}
              </p>
              <p>
                <span className="font-medium">Method:</span> {job.product.method || 'Spray'}
              </p>
              {job.product.harvestIntervalDays && (
                <p>
                  <span className="font-medium">Harvest Interval:</span> {job.product.harvestIntervalDays} days
                </p>
              )}
            </div>
          </div>

          {/* Tank mix warning */}
          {job.product.isTankMix && job.product.tankMixProducts && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Beaker className="h-4 w-4 text-purple-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-purple-800">Tank Mix</p>
                  <p className="text-xs text-purple-600 mt-1">
                    This job includes multiple products. Ensure compatibility before mixing:
                  </p>
                  <ul className="text-xs text-purple-700 mt-2 space-y-1">
                    {job.product.tankMixProducts.map((product, idx) => (
                      <li key={idx}>• {product}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Calculator */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Total Water Volume (Litres)</Label>
              <Input
                type="number"
                value={totalVolumeLitres}
                onChange={(e) => setTotalVolumeLitres(e.target.value)}
                min="1"
                step="0.5"
              />
            </div>

            {calculations ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Droplets className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Mix Instructions</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-green-700">Water:</span>
                    <span className="font-medium text-green-800">
                      {calculations.waterAmount} litres
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-green-700">Product ({job.name}):</span>
                    <span className="font-medium text-green-800 text-lg">
                      {calculations.productAmount} {calculations.unit}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Cannot calculate</p>
                    <p className="text-xs text-amber-600 mt-1">
                      The rate unit ({job.product.rateUnit}) requires additional information
                      (e.g., area) to calculate the mix amount.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Safety reminder */}
          <div className="p-3 bg-slate-100 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Safety:</strong> Always wear appropriate PPE when handling plant protection
              products. Refer to the product label for specific safety instructions and re-entry
              intervals.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
