'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import bwipjs from 'bwip-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescriptionHidden,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Printer, Loader2, Plus, Minus, MapPin, Edit3, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { NurseryLocation, Batch } from '@/lib/types';

type LocationWithBatches = NurseryLocation & {
  batches: Batch[];
  batchCount: number;
  totalQuantity: number;
};

type Printer = {
  id: string;
  name: string;
  type: string;
  connection_type: string;
  host?: string;
  port?: number;
  is_default: boolean;
  dpi: number;
};

type LocationLabelPreviewProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  location: LocationWithBatches;
};

export function LocationLabelPreview({ open, onOpenChange, location }: LocationLabelPreviewProps) {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [copies, setCopies] = useState<number>(1);
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch printers when dialog opens
  useEffect(() => {
    if (open) {
      fetchPrinters();
    }
  }, [open]);

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/printers');
      const json = await res.json();
      if (json.data) {
        setPrinters(json.data);
        const defaultPrinter = json.data.find((p: Printer) => p.is_default);
        if (defaultPrinter) {
          setSelectedPrinter(defaultPrinter.id);
        } else if (json.data.length > 0) {
          setSelectedPrinter(json.data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch printers:', e);
    }
  };

  const printToZebra = async () => {
    if (!selectedPrinter && printers.length > 0) {
      toast({
        variant: 'destructive',
        title: 'No Printer Selected',
        description: 'Please select a printer before printing.',
      });
      return;
    }

    setIsPrinting(true);
    try {
      const res = await fetch(`/api/labels/print-location`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locationId: location.id,
          locationName: location.name,
          nurserySite: location.nurserySite,
          type: location.type,
          siteId: location.siteId,
          batchCount: location.batchCount,
          totalQuantity: location.totalQuantity,
          batches: location.batches.slice(0, 10).map((b) => ({
            batchNumber: b.batchNumber,
            variety: b.plantVariety,
            quantity: b.quantity,
            pottedDate: b.plantedAt || b.plantingDate,
          })),
          payload: `ht:loc:${location.id}`,
          printerId: selectedPrinter || undefined,
          copies,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || res.statusText);
      }

      toast({
        title: 'Print Job Sent',
        description:
          copies > 1
            ? `${copies} labels have been sent to the printer.`
            : 'The label has been sent to the printer.',
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Print Failed',
        description: e.message || 'Could not connect to the printer.',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Location Label • {location.name}
          </DialogTitle>
          <DialogDescriptionHidden>Preview and print label for location</DialogDescriptionHidden>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Label Preview */}
          <div className="flex justify-center items-center py-4 bg-muted/30 rounded-lg">
            <LocationLabel location={location} />
          </div>

          {/* Print Options */}
          <div className="grid gap-4">
            {/* Label Layout Link */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg">
              <span className="text-sm text-muted-foreground">Label Template</span>
              <Link
                href="/settings/labels/editor?type=location"
                className="text-xs text-primary hover:underline flex items-center gap-1"
                target="_blank"
              >
                <Edit3 className="h-3 w-3" />
                Edit Layout
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {/* Printer Selection */}
            <div className="space-y-2">
              <Label htmlFor="printer" className="text-sm font-medium">
                Printer
              </Label>
              {printers.length > 0 ? (
                <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                  <SelectTrigger id="printer">
                    <SelectValue placeholder="Select a printer" />
                  </SelectTrigger>
                  <SelectContent>
                    {printers.map((printer) => (
                      <SelectItem key={printer.id} value={printer.id}>
                        <div className="flex items-center gap-2">
                          <span>{printer.name}</span>
                          {printer.is_default && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No printers configured. Configure one in Settings.
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="copies" className="text-sm font-medium">
                Number of Copies
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCopies(Math.max(1, copies - 1))}
                  disabled={copies <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="copies"
                  type="number"
                  min={1}
                  max={100}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCopies(Math.min(100, copies + 1))}
                  disabled={copies >= 100}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground ml-2">
                  {copies === 1 ? 'label' : 'labels'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-2 flex-shrink-0" />

        <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={printToZebra}
            disabled={isPrinting || (printers.length > 0 && !selectedPrinter)}
            className="min-w-[100px]"
          >
            {isPrinting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Printing...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Print {copies > 1 ? `(${copies})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Location Label Component (for preview)
function LocationLabel({ location }: { location: LocationWithBatches }) {
  const dmRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!dmRef.current) return;
    try {
      bwipjs.toCanvas(dmRef.current, {
        bcid: 'datamatrix',
        text: `ht:loc:${location.id}`,
        scale: 3,
        includetext: false,
      });
    } catch (e) {
      console.error('DataMatrix render failed:', e);
    }
  }, [location.id]);

  // Get top 5 varieties
  const topVarieties = React.useMemo(() => {
    const varietyCounts: Record<string, { name: string; count: number }> = {};
    location.batches.forEach((batch) => {
      const name = batch.plantVariety || 'Unknown';
      if (!varietyCounts[name]) {
        varietyCounts[name] = { name, count: 0 };
      }
      varietyCounts[name].count += batch.quantity ?? 0;
    });
    return Object.values(varietyCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [location.batches]);

  return (
    <div
      style={{
        width: '100mm',
        height: '70mm',
        boxSizing: 'border-box',
        padding: '4mm',
        background: 'white',
        border: '1px solid rgba(0,0,0,.08)',
        borderRadius: 6,
        boxShadow: '0 6px 24px rgba(0,0,0,.10)',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header: Location name + DataMatrix */}
      <div style={{ display: 'flex', gap: '3mm', marginBottom: '3mm' }}>
        {/* Left: DataMatrix */}
        <div style={{ flexShrink: 0 }}>
          <canvas ref={dmRef} style={{ width: '22mm', height: '22mm' }} />
        </div>

        {/* Right: Location info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: '7mm',
              lineHeight: 1.1,
              letterSpacing: '-0.1mm',
            }}
          >
            {location.name}
          </div>
          <div
            style={{
              fontSize: '3.5mm',
              lineHeight: 1.3,
              opacity: 0.8,
              marginTop: '1.5mm',
            }}
          >
            {location.nurserySite || 'Main'} • {location.type || 'Section'}
          </div>
          <div
            style={{
              fontSize: '3mm',
              lineHeight: 1.3,
              marginTop: '1.5mm',
              display: 'flex',
              gap: '3mm',
            }}
          >
            <span>
              <strong>{location.batchCount}</strong> batches
            </span>
            <span>
              <strong>{location.totalQuantity.toLocaleString()}</strong> plants
            </span>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,.1)', marginBottom: '2mm' }} />

      {/* Contents: Top varieties */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: '2.5mm', fontWeight: 600, marginBottom: '1.5mm', opacity: 0.7 }}>
          CONTENTS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1mm' }}>
          {topVarieties.map((v) => (
            <div
              key={v.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '3mm',
                lineHeight: 1.4,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {v.name}
              </span>
              <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: '2mm' }}>
                {v.count.toLocaleString()}
              </span>
            </div>
          ))}
          {topVarieties.length === 0 && (
            <div style={{ fontSize: '3mm', opacity: 0.6, fontStyle: 'italic' }}>Empty location</div>
          )}
        </div>
      </div>

      {/* Footer: Date & site ID */}
      <div
        style={{
          borderTop: '1px solid rgba(0,0,0,.1)',
          paddingTop: '2mm',
          marginTop: 'auto',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '2.5mm',
          opacity: 0.7,
        }}
      >
        <span>Printed: {new Date().toLocaleDateString()}</span>
        {location.siteId && <span>ID: {location.siteId}</span>}
      </div>
    </div>
  );
}







