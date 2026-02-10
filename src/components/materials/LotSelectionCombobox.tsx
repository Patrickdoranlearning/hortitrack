'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, Package, Calendar, MapPin, ScanLine, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import type { AvailableLot, FifoSelectionResult } from '@/lib/types/material-lots';

type LotSelectionComboboxProps = {
  materialId: string;
  requiredQuantity?: number;
  locationId?: string;
  value: string | null;
  onChange: (lot: AvailableLot | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showFifoSuggestion?: boolean;
};

export function LotSelectionCombobox({
  materialId,
  requiredQuantity,
  locationId,
  value,
  onChange,
  placeholder = 'Select a lot...',
  disabled = false,
  showFifoSuggestion = true,
}: LotSelectionComboboxProps) {
  const [open, setOpen] = useState(false);
  const [lots, setLots] = useState<AvailableLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLot, setSelectedLot] = useState<AvailableLot | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch available lots
  const fetchLots = useCallback(async () => {
    if (!materialId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ materialId });
      if (requiredQuantity) params.set('requiredQuantity', String(requiredQuantity));
      if (locationId) params.set('locationId', locationId);

      const res = await fetch(`/api/materials/lots/fifo?${params}`);
      if (!res.ok) throw new Error('Failed to fetch lots');

      const data: FifoSelectionResult = await res.json();
      setLots(data.lots);

      // If there's a value but no selectedLot, find it
      if (value && !selectedLot) {
        const found = data.lots.find((l) => l.lotId === value);
        if (found) {
          setSelectedLot(found);
        }
      }
    } catch {
      // Lot fetch failed silently
    } finally {
      setLoading(false);
    }
  }, [materialId, requiredQuantity, locationId, value, selectedLot]);

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  const handleSelect = (lot: AvailableLot) => {
    setSelectedLot(lot);
    onChange(lot);
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedLot(null);
    onChange(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const isExpiringSoon = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry <= thirtyDaysFromNow;
  };

  // Filter lots based on search
  const filteredLots = lots.filter((lot) =>
    lot.lotNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (lot.supplierLotNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !selectedLot && 'text-muted-foreground'
          )}
          disabled={disabled}
        >
          {selectedLot ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-mono truncate">{selectedLot.lotNumber}</span>
              <Badge variant="outline" className="shrink-0">
                {selectedLot.currentQuantity}
              </Badge>
              {selectedLot.isSuggested && showFifoSuggestion && (
                <Badge variant="secondary" className="shrink-0">
                  <Sparkles className="h-3 w-3 mr-1" />
                  FIFO
                </Badge>
              )}
            </div>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <ScanLine className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search or scan lot barcode..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading lots...
              </div>
            ) : filteredLots.length === 0 ? (
              <CommandEmpty>No lots available for this material.</CommandEmpty>
            ) : (
              <>
                {/* FIFO Suggested Lots */}
                {showFifoSuggestion && filteredLots.some((l) => l.isSuggested) && (
                  <CommandGroup heading="Suggested (FIFO)">
                    {filteredLots
                      .filter((l) => l.isSuggested)
                      .map((lot) => (
                        <LotItem
                          key={lot.lotId}
                          lot={lot}
                          isSelected={value === lot.lotId}
                          onSelect={() => handleSelect(lot)}
                          formatDate={formatDate}
                          isExpiringSoon={isExpiringSoon}
                        />
                      ))}
                  </CommandGroup>
                )}

                {/* Other Available Lots */}
                {filteredLots.some((l) => !l.isSuggested) && (
                  <CommandGroup heading="Other Available">
                    {filteredLots
                      .filter((l) => !l.isSuggested)
                      .map((lot) => (
                        <LotItem
                          key={lot.lotId}
                          lot={lot}
                          isSelected={value === lot.lotId}
                          onSelect={() => handleSelect(lot)}
                          formatDate={formatDate}
                          isExpiringSoon={isExpiringSoon}
                        />
                      ))}
                  </CommandGroup>
                )}

                {/* All lots when no FIFO distinction */}
                {!showFifoSuggestion && (
                  <CommandGroup>
                    {filteredLots.map((lot) => (
                      <LotItem
                        key={lot.lotId}
                        lot={lot}
                        isSelected={value === lot.lotId}
                        onSelect={() => handleSelect(lot)}
                        formatDate={formatDate}
                        isExpiringSoon={isExpiringSoon}
                      />
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>

        {selectedLot && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={handleClear}
            >
              Clear selection (use any available stock)
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function LotItem({
  lot,
  isSelected,
  onSelect,
  formatDate,
  isExpiringSoon,
}: {
  lot: AvailableLot;
  isSelected: boolean;
  onSelect: () => void;
  formatDate: (date: string) => string;
  isExpiringSoon: (date: string | null | undefined) => boolean;
}) {
  return (
    <CommandItem
      value={lot.lotNumber}
      onSelect={onSelect}
      className="flex items-center justify-between py-2"
    >
      <div className="flex items-center gap-2">
        <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
        <div>
          <div className="font-mono font-medium">{lot.lotNumber}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(lot.receivedAt)}
            </span>
            {lot.locationName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {lot.locationName}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {lot.expiryDate && isExpiringSoon(lot.expiryDate) && (
          <Badge variant="destructive" className="text-xs">
            Expiring
          </Badge>
        )}
        <Badge variant="outline">{lot.currentQuantity}</Badge>
      </div>
    </CommandItem>
  );
}

export type { AvailableLot };
