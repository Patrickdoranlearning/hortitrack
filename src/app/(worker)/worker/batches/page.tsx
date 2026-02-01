"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ScanLine,
  Filter,
  Loader2,
  AlertCircle,
  Package,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";
import { BatchHealthBadge } from "@/components/worker/batch/BatchHealthBadge";
import type { WorkerBatch } from "@/types/worker";

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "all" },
  { label: "Growing", value: "Growing" },
  { label: "Ready for Sale", value: "Ready for Sale" },
  { label: "Looking Good", value: "Looking Good" },
  { label: "Propagation", value: "Propagation" },
  { label: "Potted", value: "Potted" },
  { label: "Incoming", value: "Incoming" },
];

export default function WorkerBatchesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [batches, setBatches] = useState<WorkerBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Fetch batches
  const fetchBatches = useCallback(
    async (pageNum: number, append = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const params = new URLSearchParams({
          page: String(pageNum),
          pageSize: String(pageSize),
          includeHealth: "true", // Include health indicators for batch cards
        });

        if (searchQuery.trim()) {
          params.set("q", searchQuery.trim());
        }

        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        const response = await fetch(`/api/worker/batches?${params}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to load batches");
        }

        const data = await response.json();

        if (append) {
          setBatches((prev) => [...prev, ...data.items]);
        } else {
          setBatches(data.items);
        }

        setTotal(data.total);
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load batches");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchQuery, statusFilter]
  );

  // Initial load and filter changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchBatches(1, false);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [fetchBatches]);

  const handleLoadMore = () => {
    if (!loadingMore && batches.length < total) {
      fetchBatches(page + 1, true);
    }
  };

  const handleRefresh = () => {
    vibrateTap();
    fetchBatches(1, false);
  };

  const handleBatchClick = (batch: WorkerBatch) => {
    vibrateTap();
    router.push(`/worker/batches/${batch.id}`);
  };

  const handleScan = () => {
    vibrateTap();
    router.push("/worker/scan");
  };

  const getStatusVariant = (
    status: string | null
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Ready for Sale":
      case "Looking Good":
        return "default";
      case "Growing":
      case "Propagation":
        return "secondary";
      case "Incoming":
        return "outline";
      default:
        return "secondary";
    }
  };

  const hasMore = batches.length < total;

  return (
    <div className="flex flex-col h-full">
      {/* Header with search */}
      <div className="sticky top-0 z-30 bg-background border-b p-4 space-y-3">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search batches..."
              className="pl-9 pr-4 h-12"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 flex-shrink-0"
            onClick={handleScan}
            aria-label="Scan barcode"
          >
            <ScanLine className="h-5 w-5" />
          </Button>
        </div>

        {/* Filters row */}
        <div className="flex items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10">
                <Filter className="h-4 w-4 mr-2" />
                {statusFilter === "all" ? "Status" : statusFilter}
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {total} batch{total !== 1 ? "es" : ""}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh"
            >
              <RefreshCw
                className={cn("h-4 w-4", loading && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Loading state */}
        {loading && batches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Loading batches...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && batches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Batches Found</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filters."
                : "No active batches in the system."}
            </p>
          </div>
        )}

        {/* Batch cards */}
        {batches.map((batch) => (
          <button
            key={batch.id}
            className={cn(
              "w-full text-left rounded-xl border bg-card p-4",
              "transition-colors active:bg-accent/50",
              "focus:outline-none focus:ring-2 focus:ring-primary/60"
            )}
            onClick={() => handleBatchClick(batch)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {/* Health indicator dot */}
                  {batch.healthLevel && (
                    <BatchHealthBadge
                      level={batch.healthLevel}
                      activeIssuesCount={batch.activeIssuesCount}
                      size="sm"
                    />
                  )}
                  <span className="font-mono text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    {batch.batchNumber}
                  </span>
                  {batch.status && (
                    <Badge variant={getStatusVariant(batch.status)} className="text-xs">
                      {batch.status}
                    </Badge>
                  )}
                </div>
                <h3 className="font-medium truncate">
                  {batch.varietyName || "Unknown Variety"}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {[batch.familyName, batch.sizeName]
                    .filter(Boolean)
                    .join(" - ") || "No details"}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-semibold">
                  {batch.quantity.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  of {batch.initialQuantity.toLocaleString()}
                </div>
              </div>
            </div>
            {batch.locationName && (
              <div className="mt-2 pt-2 border-t text-sm text-muted-foreground">
                {batch.locationName}
              </div>
            )}
          </button>
        ))}

        {/* Load more button */}
        {hasMore && !loading && (
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              `Load More (${batches.length} of ${total})`
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
