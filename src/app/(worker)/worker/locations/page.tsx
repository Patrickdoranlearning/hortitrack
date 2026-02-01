"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Search,
  QrCode,
  MapPin,
  RefreshCw,
  Warehouse,
  Sprout,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import ScannerDialog from "@/components/scan-and-act-dialog";
import type { WorkerLocation, WorkerLocationsResponse } from "@/types/worker";

async function fetchLocations(url: string): Promise<WorkerLocationsResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch locations");
  return res.json();
}

export default function WorkerLocationsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR("/api/worker/locations", fetchLocations);

  // Filter locations by search
  const filteredLocations = useMemo(() => {
    const locations = data?.items ?? [];
    if (!searchQuery.trim()) return locations;
    const q = searchQuery.toLowerCase();
    return locations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        loc.nurserySite?.toLowerCase().includes(q) ||
        loc.type?.toLowerCase().includes(q)
    );
  }, [data?.items, searchQuery]);

  const handleRefresh = async () => {
    vibrateTap();
    setRefreshing(true);
    try {
      await mutate();
      vibrateSuccess();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLocationClick = (location: WorkerLocation) => {
    vibrateTap();
    router.push(`/worker/locations/${location.id}`);
  };

  const handleScanDetected = useCallback(
    (text: string) => {
      if (!text) return;
      setIsScanOpen(false);

      // Check if it's a location code (format: ht:loc:<id>)
      if (text.startsWith("ht:loc:")) {
        const locationId = text.replace("ht:loc:", "");
        router.push(`/worker/locations/${locationId}`);
      } else if (text.match(/^[0-9a-f-]{36}$/i)) {
        // UUID - could be location ID
        router.push(`/worker/locations/${text}`);
      } else {
        // Might be a batch code - redirect to scan page
        router.push(`/worker/scan?code=${encodeURIComponent(text)}`);
      }
    },
    [router]
  );

  const getTypeIcon = (type: string | null) => {
    switch (type?.toLowerCase()) {
      case "polytunnel":
      case "greenhouse":
        return Warehouse;
      case "outdoor":
      case "field":
        return Sprout;
      default:
        return MapPin;
    }
  };

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      refreshing={refreshing}
      className="h-full"
    >
      <div className="px-4 py-4 space-y-4">
        {/* Search and Scan Header */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search locations..."
              className="pl-9 h-12"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 flex-shrink-0"
            onClick={() => {
              vibrateTap();
              setIsScanOpen(true);
            }}
          >
            <QrCode className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 flex-shrink-0"
            onClick={handleRefresh}
            disabled={isLoading || refreshing}
          >
            <RefreshCw
              className={cn("h-5 w-5", (isLoading || refreshing) && "animate-spin")}
            />
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground mb-4">Failed to load locations</p>
            <Button onClick={handleRefresh} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredLocations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "No Matches Found" : "No Locations"}
            </h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              {searchQuery
                ? "Try adjusting your search"
                : "No locations have been set up yet"}
            </p>
          </div>
        )}

        {/* Location Grid */}
        {!isLoading && !error && filteredLocations.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {filteredLocations.map((location) => {
              const TypeIcon = getTypeIcon(location.type);
              const hasIssues = (location.capacityPercent ?? 0) > 80;

              return (
                <Card
                  key={location.id}
                  className={cn(
                    "transition-all active:scale-[0.98]",
                    "cursor-pointer hover:shadow-md",
                    "touch-manipulation"
                  )}
                  onClick={() => handleLocationClick(location)}
                >
                  <CardContent className="p-3">
                    {/* Location Name and Type Icon */}
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {location.name}
                        </h3>
                        {location.nurserySite && (
                          <p className="text-xs text-muted-foreground truncate">
                            {location.nurserySite}
                          </p>
                        )}
                      </div>
                      <div
                        className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                          location.covered
                            ? "bg-blue-100 text-blue-600"
                            : "bg-green-100 text-green-600"
                        )}
                      >
                        <TypeIcon className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Batch Count */}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {location.batchCount} batch{location.batchCount !== 1 ? "es" : ""}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {location.totalQuantity.toLocaleString()} plants
                      </span>
                    </div>

                    {/* Capacity Bar */}
                    {location.capacityPercent !== null && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Capacity</span>
                          <span
                            className={cn(
                              hasIssues ? "text-amber-600 font-medium" : "text-muted-foreground"
                            )}
                          >
                            {location.capacityPercent}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              hasIssues ? "bg-amber-500" : "bg-green-500"
                            )}
                            style={{ width: `${Math.min(100, location.capacityPercent)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Scanner Dialog */}
      <ScannerDialog
        open={isScanOpen}
        onOpenChange={setIsScanOpen}
        onDetected={handleScanDetected}
      />
    </PullToRefresh>
  );
}
