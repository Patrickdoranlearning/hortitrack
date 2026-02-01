"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  Printer,
  Search,
  RefreshCw,
  AlertCircle,
  Package,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import type {
  WorkerLocationDetail,
  WorkerLocationBatch,
} from "@/app/api/worker/locations/[id]/route";

async function fetchLocationDetail(url: string): Promise<WorkerLocationDetail> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Location not found");
    throw new Error("Failed to fetch location");
  }
  return res.json();
}

export default function WorkerLocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "healthy" | "warning" | "critical">("all");

  const {
    data: location,
    error,
    isLoading,
    mutate,
  } = useSWR(`/api/worker/locations/${locationId}`, fetchLocationDetail);

  // Filter batches
  const filteredBatches = useMemo(() => {
    if (!location?.batches) return [];

    let batches = location.batches;

    // Apply health filter
    if (filter !== "all") {
      batches = batches.filter((b) => b.healthStatus === filter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      batches = batches.filter(
        (b) =>
          b.batchNumber.toLowerCase().includes(q) ||
          b.varietyName?.toLowerCase().includes(q)
      );
    }

    return batches;
  }, [location?.batches, filter, searchQuery]);

  const handleBack = () => {
    vibrateTap();
    router.back();
  };

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

  const handleBatchClick = (batch: WorkerLocationBatch) => {
    vibrateTap();
    router.push(`/worker/batches/${batch.id}`);
  };

  const handleScoutLocation = () => {
    vibrateTap();
    router.push(`/worker/scout/location/${locationId}`);
  };

  const handlePrintLabel = () => {
    vibrateTap();
    window.open(`/production/locations/${locationId}/print`, "_blank");
  };

  const getHealthBadgeVariant = (
    status: "healthy" | "warning" | "critical" | null
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "healthy":
        return "default";
      case "warning":
        return "secondary";
      case "critical":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getHealthLabel = (status: "healthy" | "warning" | "critical" | null): string => {
    switch (status) {
      case "healthy":
        return "Healthy";
      case "warning":
        return "Warning";
      case "critical":
        return "Critical";
      default:
        return "Not scouted";
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={handleBack} onRefresh={handleRefresh} loading={true} />
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !location) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={handleBack} onRefresh={handleRefresh} loading={false} />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">
            {error?.message || "Location not found"}
          </p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing} className="h-full">
      <div className="flex flex-col h-full">
        <Header
          onBack={handleBack}
          onRefresh={handleRefresh}
          loading={refreshing}
          title={location.name}
        />

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Location Header Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold truncate">{location.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {[location.type, location.nurserySite].filter(Boolean).join(" - ") ||
                      "Nursery Location"}
                  </p>
                </div>
                <Badge variant={location.covered ? "secondary" : "outline"}>
                  {location.covered ? "Covered" : "Outdoor"}
                </Badge>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-muted/50 rounded-lg">
                  <div className="text-lg font-bold">{location.batchCount}</div>
                  <div className="text-xs text-muted-foreground">Batches</div>
                </div>
                <div className="p-2 bg-muted/50 rounded-lg">
                  <div className="text-lg font-bold">
                    {location.totalQuantity.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Plants</div>
                </div>
                {location.area && (
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg font-bold">{location.area}</div>
                    <div className="text-xs text-muted-foreground">m2</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Health Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Health Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div
                  className={cn(
                    "p-2 rounded-lg cursor-pointer transition-all",
                    filter === "healthy" ? "bg-green-100 ring-2 ring-green-500" : "bg-muted/50"
                  )}
                  onClick={() => {
                    vibrateTap();
                    setFilter(filter === "healthy" ? "all" : "healthy");
                  }}
                >
                  <div className="text-lg font-bold text-green-600">
                    {location.healthSummary.healthy}
                  </div>
                  <div className="text-xs text-muted-foreground">Healthy</div>
                </div>
                <div
                  className={cn(
                    "p-2 rounded-lg cursor-pointer transition-all",
                    filter === "warning" ? "bg-amber-100 ring-2 ring-amber-500" : "bg-muted/50"
                  )}
                  onClick={() => {
                    vibrateTap();
                    setFilter(filter === "warning" ? "all" : "warning");
                  }}
                >
                  <div className="text-lg font-bold text-amber-600">
                    {location.healthSummary.warning}
                  </div>
                  <div className="text-xs text-muted-foreground">Warning</div>
                </div>
                <div
                  className={cn(
                    "p-2 rounded-lg cursor-pointer transition-all",
                    filter === "critical" ? "bg-red-100 ring-2 ring-red-500" : "bg-muted/50"
                  )}
                  onClick={() => {
                    vibrateTap();
                    setFilter(filter === "critical" ? "all" : "critical");
                  }}
                >
                  <div className="text-lg font-bold text-red-600">
                    {location.healthSummary.critical}
                  </div>
                  <div className="text-xs text-muted-foreground">Critical</div>
                </div>
                <div className="p-2 bg-muted/50 rounded-lg">
                  <div className="text-lg font-bold text-muted-foreground">
                    {location.healthSummary.notScouted}
                  </div>
                  <div className="text-xs text-muted-foreground">Unscouted</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1 h-12"
              onClick={handleScoutLocation}
            >
              <Search className="h-4 w-4 mr-2" />
              Scout Location
            </Button>
            <Button
              variant="outline"
              className="h-12 px-4"
              onClick={handlePrintLabel}
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>

          {/* Batch List */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Batches ({filteredBatches.length})
                </CardTitle>
                {filter !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      vibrateTap();
                      setFilter("all");
                    }}
                  >
                    Clear filter
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {/* Search within batches */}
              {location.batchCount > 5 && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search batches..."
                    className="pl-9 h-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}

              {/* Batch Items */}
              {filteredBatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery || filter !== "all"
                    ? "No batches match your criteria"
                    : "No batches at this location"}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        "cursor-pointer active:bg-muted/50 transition-all",
                        "touch-manipulation"
                      )}
                      onClick={() => handleBatchClick(batch)}
                    >
                      <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {batch.batchNumber}
                          </span>
                          <Badge
                            variant={getHealthBadgeVariant(batch.healthStatus)}
                            className="text-xs"
                          >
                            {getHealthLabel(batch.healthStatus)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {batch.varietyName || "Unknown variety"}
                          {batch.sizeName && ` - ${batch.sizeName}`}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>{batch.quantity.toLocaleString()} plants</span>
                          {batch.daysAtLocation !== null && (
                            <span>{batch.daysAtLocation}d here</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PullToRefresh>
  );
}

// Header component
function Header({
  onBack,
  onRefresh,
  loading,
  title,
}: {
  onBack: () => void;
  onRefresh: () => void;
  loading: boolean;
  title?: string;
}) {
  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] -ml-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="font-medium truncate max-w-[50%]">{title || "Location"}</h1>

        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] -mr-2"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
}
