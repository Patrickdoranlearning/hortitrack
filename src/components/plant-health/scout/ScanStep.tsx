'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ScanLine,
  MapPin,
  Package,
  Loader2,
  Search,
  Camera,
  Sprout,
} from 'lucide-react';
import { toast } from 'sonner';
import ScannerClient from '@/components/Scanner/ScannerClient';
import { parseScanCode } from '@/lib/scan/parse.client';
import type { ScannedTarget, Batch } from './ScoutWizard';

type SearchResult = {
  type: 'location' | 'batch';
  id: string;
  name: string;
  description?: string;
};

type ScanStepProps = {
  onTargetSelected: (target: ScannedTarget) => void;
};

export function ScanStep({ onTargetSelected }: ScanStepProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for locations and batches - optimized single endpoint
  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/scout-search?q=${encodeURIComponent(query)}`);
      const data = res.ok ? await res.json() : { locations: [], batches: [] };

      const results: SearchResult[] = [
        ...(data.locations || []).map((l: any) => ({
          type: 'location' as const,
          id: l.id,
          name: l.name,
          description: l.description,
        })),
        ...(data.batches || []).map((b: any) => ({
          type: 'batch' as const,
          id: b.id,
          name: b.batchNumber,
          description: [b.variety, b.family].filter(Boolean).join(' · '),
        })),
      ];

      setSearchResults(results);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search - 150ms for responsive feel
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (searchQuery.length >= 2) {
      searchTimeout.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 150);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery, performSearch]);

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

  const loadLocationDetails = async (locationId: string, locationName: string) => {
    setLoading(true);
    try {
      const batchesRes = await fetch(`/api/locations/${locationId}/batches`);
      const batchesData = batchesRes.ok ? await batchesRes.json() : { batches: [] };

      const target: ScannedTarget = {
        type: 'location',
        location: {
          id: locationId,
          name: locationName,
          batches: (batchesData.batches || []).map((b: any) => ({
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
  };

  const handleSelectResult = async (result: SearchResult) => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);

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
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const parsed = parseScanCode(searchQuery.trim());
      if (parsed) {
        handleScan(searchQuery.trim());
      } else if (searchResults.length > 0) {
        handleSelectResult(searchResults[0]);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Bar with Scanner */}
      <div className="relative" ref={searchContainerRef}>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search location or batch..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              className="pl-10 pr-4 h-12 text-lg"
              autoComplete="off"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="h-12 px-4"
            onClick={() => setScannerOpen(true)}
          >
            <Camera className="h-5 w-5 mr-2" />
            Scan
          </Button>
        </form>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <Card className="absolute z-50 w-full mt-1 shadow-lg">
            <CardContent className="p-2">
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors"
                  onClick={() => handleSelectResult(result)}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {result.type === 'location' ? (
                      <MapPin className="h-5 w-5 text-primary" />
                    ) : (
                      <Sprout className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {result.type === 'location' ? 'Location' : 'Batch'}
                      {result.description && ` · ${result.description}`}
                    </p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {showResults && searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
          <Card className="absolute z-50 w-full mt-1 shadow-lg">
            <CardContent className="p-6 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No results found</p>
              <p className="text-sm">Try scanning a QR code instead</p>
            </CardContent>
          </Card>
        )}
      </div>

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

