'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, ScanLine, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MaterialScannerDialog } from './MaterialScannerDialog';

export type MaterialSearchResult = {
  id: string;
  part_number: string;
  name: string;
  description: string | null;
  category_name: string;
  parent_group: string;
  base_uom: string;
  linked_size_id: string | null;
  barcode: string | null;
  internal_barcode: string | null;
};

type Props = {
  sizeId?: string;
  value: string | null;
  onChange: (material: MaterialSearchResult | null) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function MaterialSearchCombobox({
  sizeId,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search materials...',
}: Props) {
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggested, setSuggested] = useState<MaterialSearchResult[]>([]);
  const [results, setResults] = useState<MaterialSearchResult[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialSearchResult | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial suggestions when sizeId changes or popover opens
  const fetchSuggestions = useCallback(async () => {
    if (!sizeId) return;

    try {
      const params = new URLSearchParams({ sizeId, limit: '20' });
      const res = await fetch(`/api/materials/search?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      setSuggested(data.suggested ?? []);
      if (!searchQuery) {
        setResults(data.results ?? []);
      }
    } catch {
      // Silently fail suggestions
    }
  }, [sizeId, searchQuery]);

  // Search materials with debounce
  const searchMaterials = useCallback(async (query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      fetchSuggestions();
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          limit: '20',
        });
        if (sizeId) params.set('sizeId', sizeId);

        const res = await fetch(`/api/materials/search?${params}`);
        if (!res.ok) {
          setResults([]);
          return;
        }

        const data = await res.json();
        setSuggested(data.suggested ?? []);
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, [sizeId, fetchSuggestions]);

  // Handle search input change
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    searchMaterials(query);
  }, [searchMaterials]);

  // Handle material selection
  const handleSelect = useCallback((material: MaterialSearchResult) => {
    setSelectedMaterial(material);
    onChange(material);
    setOpen(false);
    setSearchQuery('');
  }, [onChange]);

  // Handle barcode scan result
  const handleScanResult = useCallback((material: MaterialSearchResult | null) => {
    setScannerOpen(false);
    if (material) {
      handleSelect(material);
    }
  }, [handleSelect]);

  // Load suggestions when popover opens
  useEffect(() => {
    if (open) {
      fetchSuggestions();
    }
  }, [open, fetchSuggestions]);

  // Clear selection
  const handleClear = useCallback(() => {
    setSelectedMaterial(null);
    onChange(null);
    setSearchQuery('');
  }, [onChange]);

  const displayValue = selectedMaterial
    ? `${selectedMaterial.part_number} - ${selectedMaterial.name}`
    : value
    ? 'Loading...'
    : null;

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'flex-1 justify-between',
              !displayValue && 'text-muted-foreground'
            )}
          >
            <span className="truncate">
              {displayValue || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[400px]" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Input
                placeholder="Search by name, part number..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <CommandList>
              <CommandEmpty>
                {isLoading ? 'Searching...' : 'No materials found.'}
              </CommandEmpty>

              {/* Suggested Materials (linked to size) */}
              {suggested.length > 0 && (
                <CommandGroup heading="Suggested (linked to size)">
                  {suggested.map((material) => (
                    <CommandItem
                      key={`suggested-${material.id}`}
                      value={`${material.name}-suggested`}
                      onSelect={() => handleSelect(material)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Check
                          className={cn(
                            'h-4 w-4',
                            selectedMaterial?.id === material.id
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{material.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {material.part_number}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          material.parent_group === 'Containers'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                        )}
                      >
                        {material.category_name}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Search Results */}
              {results.length > 0 && (
                <CommandGroup heading={suggested.length > 0 ? 'All Materials' : 'Materials'}>
                  {results.map((material) => (
                    <CommandItem
                      key={material.id}
                      value={material.name}
                      onSelect={() => handleSelect(material)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Check
                          className={cn(
                            'h-4 w-4',
                            selectedMaterial?.id === material.id
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{material.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {material.part_number}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          material.parent_group === 'Containers'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : material.parent_group === 'Growing Media'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        )}
                      >
                        {material.category_name}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Scan Button */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={() => setScannerOpen(true)}
        title="Scan barcode"
      >
        <ScanLine className="h-4 w-4" />
      </Button>

      {/* Scanner Dialog */}
      <MaterialScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onMaterialFound={handleScanResult}
      />
    </div>
  );
}
