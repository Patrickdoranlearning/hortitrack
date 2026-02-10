"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Package, Loader2, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MaterialSearchResult {
  id: string;
  partNumber: string;
  name: string;
  categoryName: string;
  uom: string;
}

interface MaterialSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (material: MaterialSearchResult) => void;
  selectedId?: string | null;
}

export function MaterialSearchSheet({
  open,
  onOpenChange,
  onSelect,
  selectedId,
}: MaterialSearchSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MaterialSearchResult[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMaterials = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "30" });
      if (query) params.set("q", query);

      const res = await fetch(`/api/worker/materials?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResults(
          data.items.map((item: {
            id: string;
            partNumber: string;
            name: string;
            categoryName: string;
            uom: string;
          }) => ({
            id: item.id,
            partNumber: item.partNumber,
            name: item.name,
            categoryName: item.categoryName,
            uom: item.uom,
          }))
        );
      }
    } catch {
      // Material search failed silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Focus input when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Load initial results
      fetchMaterials("");
    }
  }, [open, fetchMaterials]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        fetchMaterials(query);
      }, 300);
    },
    [fetchMaterials]
  );

  const handleSelect = (material: MaterialSearchResult) => {
    onSelect(material);
    onOpenChange(false);
    setSearchQuery("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Select Material</SheetTitle>
        </SheetHeader>

        {/* Search Input */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search by name or part number..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto mt-4 -mx-6 px-6">
          {results.length === 0 && !isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No materials found</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {results.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => handleSelect(material)}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border transition-colors",
                    "active:scale-[0.99]",
                    selectedId === material.id
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-accent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {selectedId === material.id && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                        <span className="font-medium truncate">{material.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground font-mono">
                        {material.partNumber}
                      </div>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0">
                      {material.categoryName}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
