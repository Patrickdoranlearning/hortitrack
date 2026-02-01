"use client";

import * as React from "react";
import { useState, useCallback, useRef } from "react";
import { Search, X, Package, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type ParentBatchOption = {
  id: string;
  batchNumber: string;
  varietyName: string | null;
  sizeName: string | null;
  locationName: string | null;
  quantity: number;
  phase: string | null;
  status: string | null;
};

interface ParentBatchSelectorProps {
  value: ParentBatchOption | null;
  onChange: (batch: ParentBatchOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Optional filter to only show certain statuses */
  statusFilter?: string[];
}

/**
 * Mobile-optimized batch selector using a bottom sheet.
 * Searches batches by batch number or variety name.
 */
export function ParentBatchSelector({
  value,
  onChange,
  placeholder = "Select parent batch",
  disabled = false,
  statusFilter = ["Growing", "Ready for Sale", "Looking Good"],
}: ParentBatchSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentBatchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const searchBatches = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q: searchQuery,
          pageSize: "20",
        });

        // Add status filter if provided
        if (statusFilter.length > 0) {
          params.set("status", statusFilter[0]); // API currently supports single status
        }

        const response = await fetch(`/api/worker/batches?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to search batches");
        }

        const data = await response.json();
        const items: ParentBatchOption[] = (data.items || []).map(
          (item: Record<string, unknown>) => ({
            id: item.id as string,
            batchNumber: item.batchNumber as string,
            varietyName: item.varietyName as string | null,
            sizeName: item.sizeName as string | null,
            locationName: item.locationName as string | null,
            quantity: (item.quantity as number) ?? 0,
            phase: item.phase as string | null,
            status: item.status as string | null,
          })
        );

        // Filter to only batches with quantity > 0
        setResults(items.filter((b) => b.quantity > 0));
      } catch {
        setError("Failed to search batches");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter]
  );

  const handleQueryChange = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchBatches(newQuery);
      }, 300);
    },
    [searchBatches]
  );

  const handleSelect = useCallback(
    (batch: ParentBatchOption) => {
      vibrateSuccess();
      onChange(batch);
      setOpen(false);
      setQuery("");
      setResults([]);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    vibrateTap();
    onChange(null);
  }, [onChange]);

  const handleOpen = useCallback(() => {
    vibrateTap();
    setOpen(true);
  }, []);

  return (
    <>
      {/* Selector button */}
      <Button
        type="button"
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-normal min-h-[56px]",
          !value && "text-muted-foreground"
        )}
        onClick={handleOpen}
        disabled={disabled}
      >
        {value ? (
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-medium">
                {value.batchNumber}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {value.varietyName || "Unknown variety"} - {value.quantity.toLocaleString()} available
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>{placeholder}</span>
          </div>
        )}
      </Button>

      {/* Search sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>Select Parent Batch</SheetTitle>
            <SheetDescription>
              Search by batch number or variety name
            </SheetDescription>
          </SheetHeader>

          {/* Search input */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search batches..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="pl-10 min-h-[48px]"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto mt-4 -mx-6 px-6 space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="text-center py-8 text-destructive text-sm">
                {error}
              </div>
            )}

            {!loading && !error && query.length < 2 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Type at least 2 characters to search
              </div>
            )}

            {!loading && !error && query.length >= 2 && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No batches found
              </div>
            )}

            {!loading &&
              !error &&
              results.map((batch) => (
                <Card
                  key={batch.id}
                  className="cursor-pointer transition-all active:scale-[0.98] hover:shadow-sm"
                  onClick={() => handleSelect(batch)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-sm font-medium">
                              {batch.batchNumber}
                            </span>
                            {batch.status && (
                              <Badge variant="secondary" className="text-xs">
                                {batch.status}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm font-medium truncate">
                            {batch.varietyName || "Unknown variety"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {batch.sizeName || "No size"} -{" "}
                            {batch.locationName || "No location"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-center gap-2">
                        <div>
                          <div className="text-lg font-semibold">
                            {batch.quantity.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            available
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default ParentBatchSelector;
