'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ScanLine,
  Loader2,
  Search,
  Camera,
  Sprout,
  MapPin,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import ScannerClient from '@/components/Scanner/ScannerClient';
import { parseScanCode } from '@/lib/scan/parse.client';

export type ScannedBatch = {
  id: string;
  batchNumber: string;
  variety: string | null;
  size: string | null;
  quantity: number | null;
  saleableQuantity: number | null;
  location: string | null;
  status: string | null;
  statusId: string | null;
  behavior: string | null;
  salesPhotoUrl: string | null;
  growerPhotoUrl: string | null;
};

type SearchResult = {
  id: string;
  batchNumber: string;
  variety: string | null;
  size: string | null;
  quantity: number | null;
  location: string | null;
  status: string | null;
  behavior: string | null;
};

type ScanStepProps = {
  onBatchSelected: (batch: ScannedBatch) => void;
};

const BEHAVIOR_STYLES: Record<string, { bg: string; text: string }> = {
  growing: { bg: 'bg-blue-100', text: 'text-blue-700' },
  available: { bg: 'bg-green-100', text: 'text-green-700' },
  archived: { bg: 'bg-slate-100', text: 'text-slate-500' },
};

export function ScanStep({ onBatchSelected }: ScanStepProps) {
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

  // Search for batches
  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `/api/production/batches/search?q=${encodeURIComponent(query)}&pageSize=10`
      );
      const data = res.ok ? await res.json() : { items: [] };

      const results: SearchResult[] = (data.items || []).map((b: any) => ({
        id: b.id,
        batchNumber: b.batch_number,
        variety: b.variety_name,
        size: b.size_name,
        quantity: b.quantity,
        location: b.location_name,
        status: b.status,
        behavior: b.behavior,
      }));

      setSearchResults(results);
    } catch {
      // Search failed silently
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
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

  const loadBatchDetails = async (batchId: string): Promise<ScannedBatch | null> => {
    try {
      const res = await fetch(`/api/batches/${batchId}`);
      if (!res.ok) {
        throw new Error('Batch not found');
      }
      const json = await res.json();
      const batch = json.data?.batch || json;

      return {
        id: batch.id,
        batchNumber: batch.batchNumber || batch.batch_number,
        variety: batch.plantVariety || batch.variety_name || batch.variety,
        size: batch.sizeName || batch.size_name || batch.size,
        quantity: batch.quantity,
        saleableQuantity: batch.saleableQuantity ?? batch.saleable_quantity ?? null,
        location: batch.locationName || batch.location_name || batch.location,
        status: batch.status,
        statusId: batch.statusId || batch.status_id,
        behavior: batch.behavior,
        salesPhotoUrl: batch.salesPhotoUrl || batch.sales_photo_url,
        growerPhotoUrl: batch.growerPhotoUrl || batch.grower_photo_url,
      };
    } catch {
      return null;
    }
  };

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
          toast.error('Not found', { description: 'No batch matches scanned code' });
        } else {
          toast.error('Scan failed', { description: `Error ${res.status}` });
        }
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (data.batch) {
        const batch: ScannedBatch = {
          id: data.batch.id,
          batchNumber: data.batch.batchNumber || data.batch.batch_number,
          variety: data.batch.plantVariety || data.batch.variety,
          size: data.batch.sizeName || data.batch.size,
          quantity: data.batch.quantity,
          saleableQuantity: data.batch.saleableQuantity ?? data.batch.saleable_quantity ?? null,
          location: data.batch.locationName || data.batch.location,
          status: data.batch.status,
          statusId: data.batch.statusId || data.batch.status_id,
          behavior: data.batch.behavior,
          salesPhotoUrl: data.batch.salesPhotoUrl || data.batch.sales_photo_url,
          growerPhotoUrl: data.batch.growerPhotoUrl || data.batch.grower_photo_url,
        };
        onBatchSelected(batch);
        toast.success('Batch found', { description: batch.batchNumber });
      } else {
        toast.error('Batch not found');
      }
    } catch {
      toast.error('Scan failed', { description: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = async (result: SearchResult) => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setLoading(true);

    try {
      const batch = await loadBatchDetails(result.id);
      if (batch) {
        onBatchSelected(batch);
        toast.success('Batch selected', { description: result.batchNumber });
      } else {
        toast.error('Failed to load batch details');
      }
    } finally {
      setLoading(false);
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
              placeholder="Search batch number or variety..."
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
              {searchResults.map((result) => {
                const behaviorStyle = BEHAVIOR_STYLES[result.behavior ?? ''] ?? {
                  bg: 'bg-slate-100',
                  text: 'text-slate-700',
                };
                return (
                  <button
                    key={result.id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors"
                    onClick={() => handleSelectResult(result)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Sprout className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">#{result.batchNumber}</p>
                        <Badge className={`${behaviorStyle.bg} ${behaviorStyle.text} text-xs`}>
                          {result.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {result.variety ?? 'Unknown variety'}
                        {result.size && ` · ${result.size}`}
                        {result.quantity != null && ` · ${result.quantity} units`}
                      </p>
                    </div>
                    {result.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {result.location}
                      </div>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        {showResults && searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
          <Card className="absolute z-50 w-full mt-1 shadow-lg">
            <CardContent className="p-6 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No batches found</p>
              <p className="text-sm">Try scanning a QR code instead</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading batch...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && (
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <ScanLine className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-lg mb-1">Step 1: Find Batch</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Search for a batch above or scan a QR code to update its saleable status and add photos.
          </p>
        </div>
      )}

      {/* Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scan Batch QR Code
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
