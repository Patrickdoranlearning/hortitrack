'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ScanLine,
  Loader2,
  Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import ScannerClient from '@/components/Scanner/ScannerClient';
import { parseScanCode } from '@/lib/scan/parse.client';
import { ScoutSearchCombobox, type ScoutSearchResult } from '@/components/ui/scout-search-combobox';
import type { ScannedTarget } from './ScoutWizard';

type ScanStepProps = {
  onTargetSelected: (target: ScannedTarget) => void;
};

export function ScanStep({ onTargetSelected }: ScanStepProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleScan = async (code: string) => {
    if (loading) return;

    const parsed = parseScanCode(code);
    if (!parsed) {
      toast.error('Unrecognized code format');
      return;
    }

    setLoading(true);
    setScannerOpen(false);

    try {
      const res = await fetch('/api/batches/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          toast.error('Not found', { description: 'No match for scanned code' });
        } else {
          toast.error('Scan failed', { description: `Error ${res.status}` });
        }
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (data.type === 'location') {
        await loadLocationDetails(data.location.id, data.location.name);
      } else if (data.batch) {
        const batch = data.batch;
        const target: ScannedTarget = {
          type: 'batch',
          batch: {
            id: batch.id,
            batchNumber: batch.batchNumber || batch.batch_number,
            variety: batch.plantVariety || batch.variety,
            quantity: batch.quantity,
            family: batch.plantFamily || batch.family,
          },
          location: batch.locationId ? {
            id: batch.locationId,
            name: batch.locationName || 'Unknown Location',
            batches: [{
              id: batch.id,
              batchNumber: batch.batchNumber || batch.batch_number,
              variety: batch.plantVariety || batch.variety,
              quantity: batch.quantity,
              family: batch.plantFamily || batch.family,
            }],
          } : undefined,
        };
        onTargetSelected(target);
        toast.success('Batch found', { description: batch.batchNumber || batch.batch_number });
      }
    } catch (error) {
      console.error('Scan error', error);
      toast.error('Scan failed', { description: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const loadLocationDetails = useCallback(async (locationId: string, locationName: string) => {
    setLoading(true);
    try {
      const batchesRes = await fetch(`/api/locations/${locationId}/batches`);
      const batchesData = batchesRes.ok ? await batchesRes.json() : { batches: [] };

      const target: ScannedTarget = {
        type: 'location',
        location: {
          id: locationId,
          name: locationName,
          batches: (batchesData.batches || []).map((b: { id: string; batch_number?: string; batchNumber?: string; plant_variety?: { name?: string; family?: string }; plantVariety?: string; variety?: string; quantity?: number; plantFamily?: string; family?: string }) => ({
            id: b.id,
            batchNumber: b.batch_number || b.batchNumber,
            variety: b.plant_variety?.name || b.plantVariety || b.variety,
            quantity: b.quantity,
            family: b.plant_variety?.family || b.plantFamily || b.family,
          })),
        },
      };
      onTargetSelected(target);
      toast.success('Location found', { description: locationName });
    } catch (error) {
      console.error('Failed to load location', error);
      toast.error('Failed to load location details');
    } finally {
      setLoading(false);
    }
  }, [onTargetSelected]);

  const handleSelectResult = useCallback(async (result: ScoutSearchResult) => {
    if (result.type === 'location') {
      await loadLocationDetails(result.id, result.name);
    } else {
      setLoading(true);
      try {
        const res = await fetch(`/api/batches/${result.id}`);
        if (res.ok) {
          const json = await res.json();
          const batch = json.data?.batch || json;
          const target: ScannedTarget = {
            type: 'batch',
            batch: {
              id: batch.id,
              batchNumber: batch.batchNumber,
              variety: batch.plantVariety,
              quantity: batch.quantity,
              family: batch.plantFamily,
            },
            location: batch.locationId ? {
              id: batch.locationId,
              name: batch.locationName || 'Unknown Location',
              batches: [{
                id: batch.id,
                batchNumber: batch.batchNumber,
                variety: batch.plantVariety,
                quantity: batch.quantity,
                family: batch.plantFamily,
              }],
            } : undefined,
          };
          onTargetSelected(target);
          toast.success('Batch found', { description: result.name });
        } else {
          toast.error('Batch not found');
        }
      } catch (error) {
        toast.error('Failed to load batch');
      } finally {
        setLoading(false);
      }
    }
  }, [loadLocationDetails, onTargetSelected]);

  return (
    <div className="space-y-6">
      {/* Search Bar with Scanner */}
      <ScoutSearchCombobox
        onSelect={handleSelectResult}
        placeholder="Search location or batch..."
        disabled={loading}
        endContent={
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="h-12 px-4"
            onClick={() => setScannerOpen(true)}
            disabled={loading}
          >
            <Camera className="h-5 w-5 mr-2" />
            Scan
          </Button>
        }
      />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && (
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <ScanLine className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-lg mb-1">Step 1: Find Target</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Search for a location or batch above, or scan a QR code to start scouting.
          </p>
        </div>
      )}

      {/* Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scan QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-b-lg">
            <ScannerClient onDecoded={handleScan} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

