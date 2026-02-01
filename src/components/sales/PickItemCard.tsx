'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Check,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Package,
  RefreshCw,
  Minus,
  Plus,
  Printer,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PickItem } from '@/server/sales/picking';
import SaleLabelPrintWizard from './SaleLabelPrintWizard';
import MultiBatchPickDialog from './MultiBatchPickDialog';

interface PickItemCardProps {
  item: PickItem;
  pickListId: string;
  onPick: (itemId: string, pickedQty: number, batchId?: string) => Promise<void>;
  onMultiBatchPick: (itemId: string, batches: Array<{ batchId: string; quantity: number }>, notes?: string) => Promise<void>;
  onSubstitute: (itemId: string) => void;
  isSubmitting?: boolean;
  readonly?: boolean;
  unitPrice?: number; // Optional price for label printing
}

const statusConfig = {
  pending: {
    label: 'To Pick',
    color: 'bg-muted text-muted-foreground',
  },
  picked: {
    label: 'Picked',
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  short: {
    label: 'Short',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
  substituted: {
    label: 'Substituted',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  skipped: {
    label: 'Skipped',
    color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
};

export default function PickItemCard({
  item,
  pickListId,
  onPick,
  onMultiBatchPick,
  onSubstitute,
  isSubmitting = false,
  readonly = false,
  unitPrice,
}: PickItemCardProps) {
  const [qty, setQty] = useState(item.targetQty);
  const [isExpanded, setIsExpanded] = useState(false);
  const [printWizardOpen, setPrintWizardOpen] = useState(false);
  const [multiBatchDialogOpen, setMultiBatchDialogOpen] = useState(false);
  const config = statusConfig[item.status];

  // Check if this was a multi-batch pick
  const isMultiBatchPick = item.batchPicks && item.batchPicks.length > 1;

  // Prepare label data
  const labelData = {
    productTitle: item.productName || item.plantVariety || 'Unknown',
    size: item.size || '',
    priceText: unitPrice != null ? `€${unitPrice.toFixed(2)}` : '',
    lotNumber: item.pickedBatchNumber || item.originalBatchNumber,
    quantity: item.status === 'picked' ? item.pickedQty : item.targetQty,
  };

  // Open the multi-batch dialog as the DEFAULT pick action
  const handlePick = () => {
    setMultiBatchDialogOpen(true);
  };

  // Handle multi-batch pick confirmation
  const handleMultiBatchConfirm = async (
    batches: Array<{ batchId: string; quantity: number }>,
    notes?: string
  ) => {
    await onMultiBatchPick(item.id, batches, notes);
    setMultiBatchDialogOpen(false);
  };

  const handleCustomPick = async () => {
    await onPick(item.id, qty, item.originalBatchId || item.pickedBatchId);
    setIsExpanded(false);
  };

  const handleMarkShort = async () => {
    await onPick(item.id, 0);
    setIsExpanded(false);
  };

  const incrementQty = () => setQty(q => Math.min(q + 1, item.targetQty));
  const decrementQty = () => setQty(q => Math.max(q - 1, 0));

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all',
        item.status === 'pending' && 'border-l-4 border-l-amber-500',
        item.status === 'picked' && 'border-l-4 border-l-green-500',
        item.status === 'short' && 'border-l-4 border-l-amber-500',
        item.status === 'substituted' && 'border-l-4 border-l-blue-500',
      )}
    >
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-lg truncate">
              {item.productName || `${item.plantVariety} - ${item.size}`}
            </div>
            <div className="text-sm text-muted-foreground">
              {item.plantVariety && item.size && (
                <span>{item.plantVariety} • {item.size}</span>
              )}
            </div>
          </div>
          <Badge className={config.color}>{config.label}</Badge>
        </div>

        {/* Quantity & Location Row */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-lg">{item.targetQty}</span>
              <span className="text-muted-foreground">units</span>
            </div>
            {item.batchLocation && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{item.batchLocation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Batch Info */}
        {(item.originalBatchNumber || item.pickedBatchNumber || isMultiBatchPick) && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <span className="text-muted-foreground">Batch:</span>
            {isMultiBatchPick ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Badge variant="outline" className="cursor-pointer gap-1 hover:bg-muted">
                    <Layers className="h-3 w-3" />
                    {item.batchPicks!.length} batches
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Batch Breakdown</p>
                    {item.batchPicks!.map(bp => (
                      <div key={bp.id} className="flex justify-between text-sm">
                        <span className="font-mono text-xs">{bp.batchNumber}</span>
                        <span>{bp.quantity} units</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-medium text-sm">
                      <span>Total</span>
                      <span>{item.pickedQty} units</span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Badge variant="outline" className="font-mono">
                {item.pickedBatchNumber || item.originalBatchNumber}
              </Badge>
            )}
            {item.substitutionReason && (
              <span className="text-xs text-blue-600">
                (substituted: {item.substitutionReason})
              </span>
            )}
          </div>
        )}

        {/* Actions for pending items */}
        {!readonly && item.status === 'pending' && (
          <>
            {!isExpanded ? (
              <div className="flex items-center gap-2">
                <Button
                  size="lg"
                  className="flex-1 gap-2 h-14 text-lg"
                  onClick={handlePick}
                  disabled={isSubmitting}
                >
                  <Package className="h-5 w-5" />
                  Pick ({item.targetQty})
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14"
                  onClick={() => setIsExpanded(true)}
                >
                  More
                </Button>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t">
                {/* Custom Quantity */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12"
                    onClick={decrementQty}
                    disabled={qty <= 0}
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <Input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(Math.min(parseInt(e.target.value) || 0, item.targetQty))}
                    className="h-12 text-center text-lg font-medium"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12"
                    onClick={incrementQty}
                    disabled={qty >= item.targetQty}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 h-12"
                    onClick={handleCustomPick}
                    disabled={isSubmitting || qty === 0}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Pick {qty} units
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onSubstitute(item.id)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Substitute Batch
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-amber-600 hover:text-amber-700"
                    onClick={handleMarkShort}
                    disabled={isSubmitting}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Mark Short
                  </Button>
                </div>

                {/* Print Label Button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setPrintWizardOpen(true)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Price Label
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setIsExpanded(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </>
        )}

        {/* Display picked info for completed items */}
        {readonly && item.status !== 'pending' && (
          <div className="pt-2 border-t text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.status === 'picked' && (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Picked {item.pickedQty} of {item.targetQty}</span>
                  </>
                )}
                {item.status === 'short' && (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>Short - only {item.pickedQty} available</span>
                  </>
                )}
                {item.status === 'substituted' && (
                  <>
                    <RefreshCw className="h-4 w-4 text-blue-500" />
                    <span>Substituted to batch {item.pickedBatchNumber}</span>
                  </>
                )}
              </div>
              {/* Print label for picked items */}
              {(item.status === 'picked' || item.status === 'substituted') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrintWizardOpen(true)}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Print Label for non-readonly picked items */}
        {!readonly && (item.status === 'picked' || item.status === 'substituted') && (
          <div className="pt-2 border-t flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrintWizardOpen(true)}
            >
              <Printer className="h-4 w-4 mr-1" />
              Print Label
            </Button>
          </div>
        )}
      </div>

      {/* Sale Label Print Wizard */}
      <SaleLabelPrintWizard
        open={printWizardOpen}
        onOpenChange={setPrintWizardOpen}
        item={labelData}
      />

      {/* Multi-Batch Pick Dialog - DEFAULT picking UI */}
      <MultiBatchPickDialog
        open={multiBatchDialogOpen}
        onOpenChange={setMultiBatchDialogOpen}
        pickItemId={item.id}
        pickListId={pickListId}
        productName={item.productName || `${item.plantVariety} - ${item.size}`}
        targetQty={item.targetQty}
        currentPicks={item.batchPicks}
        onConfirm={handleMultiBatchConfirm}
      />
    </Card>
  );
}

