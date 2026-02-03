"use client";

import * as React from "react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Search, Loader2, MapPin, Sprout } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ScoutSearchResult {
  type: "location" | "batch";
  id: string;
  name: string;
  description?: string;
}

interface ScoutSearchComboboxProps {
  /** Called when a result is selected */
  onSelect: (result: ScoutSearchResult) => void;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Message to show when no results are found */
  emptyMessage?: string;
  /** Whether the search is disabled */
  disabled?: boolean;
  /** Optional className for the container */
  className?: string;
  /** Additional content to render after the input (e.g., scan button) */
  endContent?: React.ReactNode;
}

/**
 * A search combobox for Scout mode that searches locations and batches.
 * Results are grouped by type (Locations, Batches) with icons.
 * Uses async search with debouncing for responsive performance.
 */
export function ScoutSearchCombobox({
  onSelect,
  placeholder = "Search location or batch...",
  emptyMessage = "No results found",
  disabled = false,
  className,
  endContent,
}: ScoutSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ScoutSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Perform search API call
  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/scout-search?q=${encodeURIComponent(query)}`);
      const data = res.ok ? await res.json() : { locations: [], batches: [] };

      const searchResults: ScoutSearchResult[] = [
        ...(data.locations || []).map((l: { id: string; name: string; description?: string }) => ({
          type: "location" as const,
          id: l.id,
          name: l.name,
          description: l.description,
        })),
        ...(data.batches || []).map((b: { id: string; batchNumber: string; variety?: string; family?: string }) => ({
          type: "batch" as const,
          id: b.id,
          name: b.batchNumber,
          description: [b.variety, b.family].filter(Boolean).join(" · "),
        })),
      ];

      setResults(searchResults);
    } catch (error) {
      console.error("Search failed", error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search - 150ms for responsive feel
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (search.length >= 2) {
      searchTimeout.current = setTimeout(() => {
        performSearch(search);
      }, 150);
    } else {
      setResults([]);
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [search, performSearch]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: { locations: ScoutSearchResult[]; batches: ScoutSearchResult[] } = {
      locations: [],
      batches: [],
    };

    for (const result of results) {
      if (result.type === "location") {
        groups.locations.push(result);
      } else {
        groups.batches.push(result);
      }
    }

    return groups;
  }, [results]);

  const handleSelect = (result: ScoutSearchResult) => {
    onSelect(result);
    setSearch("");
    setResults([]);
    setOpen(false);
  };

  const handleInputFocus = () => {
    setOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (e.target.value.length >= 2) {
      setOpen(true);
    }
  };

  const hasResults = results.length > 0;
  const showEmpty = search.length >= 2 && !searching && !hasResults;

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open && (hasResults || showEmpty || searching)} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              className={cn(
                "flex h-12 w-full rounded-md border border-input bg-background pl-10 pr-10 py-2 text-lg",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              placeholder={placeholder}
              value={search}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => {
            // Prevent focus from moving to the popover content
            e.preventDefault();
          }}
        >
          <Command shouldFilter={false}>
            <CommandList className="max-h-[300px] overflow-y-auto">
              {searching && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Searching...
                </div>
              )}
              {showEmpty && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{emptyMessage}</p>
                  <p className="text-xs mt-1">Try scanning a QR code instead</p>
                </div>
              )}
              {!searching && groupedResults.locations.length > 0 && (
                <CommandGroup heading={`Locations (${groupedResults.locations.length})`}>
                  {groupedResults.locations.map((result) => (
                    <CommandItem
                      key={`location-${result.id}`}
                      value={result.name}
                      onSelect={() => handleSelect(result)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.name}</p>
                          {result.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {result.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {!searching && groupedResults.batches.length > 0 && (
                <CommandGroup heading={`Batches (${groupedResults.batches.length})`}>
                  {groupedResults.batches.map((result) => (
                    <CommandItem
                      key={`batch-${result.id}`}
                      value={result.name}
                      onSelect={() => handleSelect(result)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Sprout className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.name}</p>
                          {result.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {result.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {endContent}
    </div>
  );
}
