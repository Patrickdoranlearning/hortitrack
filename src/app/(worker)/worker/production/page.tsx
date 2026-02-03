"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Package,
  WifiOff,
  ChevronRight,
  Sprout,
  GitBranch,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import { vibrateSuccess, vibrateTap } from "@/lib/haptics";
import type { WorkerBatch } from "@/types/worker";

interface RecentBatchesResponse {
  items: WorkerBatch[];
  total: number;
}

export default function ProductionLandingPage() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [recentBatches, setRecentBatches] = useState<WorkerBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // Track online status
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch recent batches
  const fetchRecentBatches = useCallback(async () => {
    try {
      setBatchesLoading(true);
      const response = await fetch("/api/worker/batches?pageSize=5");
      if (!response.ok) {
        throw new Error("Failed to fetch batches");
      }
      const data: RecentBatchesResponse = await response.json();
      setRecentBatches(data.items);
    } catch {
      // Silent fail - UI will show empty state
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentBatches();
  }, [fetchRecentBatches]);

  // Handle refresh button click
  const handleRefresh = async () => {
    vibrateTap();
    setRefreshing(true);
    try {
      await fetchRecentBatches();
      vibrateSuccess();
    } finally {
      setRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const handlePullRefresh = async () => {
    vibrateTap();
    await fetchRecentBatches();
    vibrateSuccess();
  };

  const handleNewBatch = () => {
    vibrateTap();
    router.push("/worker/batches/create");
  };

  const handleViewBatches = () => {
    vibrateTap();
    router.push("/worker/batches");
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

  return (
    <PullToRefresh
      onRefresh={handlePullRefresh}
      refreshing={refreshing}
      enabled={isOnline}
      className="h-full"
    >
      <div className="px-4 py-4 space-y-6">
        {/* Offline Notice */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm">
            <WifiOff className="h-4 w-4 flex-shrink-0" />
            <span>Offline mode. Pull down to refresh when online.</span>
          </div>
        )}

        {/* Primary Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="default"
            className="h-20 flex-col gap-1.5"
            onClick={() => {
              vibrateTap();
              router.push("/worker/production/propagate");
            }}
          >
            <Sprout className="h-6 w-6" />
            <span className="text-xs">Propagate</span>
          </Button>
          <Button
            variant="default"
            className="h-20 flex-col gap-1.5"
            onClick={() => {
              vibrateTap();
              router.push("/worker/production/transplant");
            }}
          >
            <GitBranch className="h-6 w-6" />
            <span className="text-xs">Transplant</span>
          </Button>
        </div>

        {/* Secondary Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-16 flex-col gap-1"
            onClick={handleNewBatch}
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs">Check In</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex-col gap-1"
            onClick={() => {
              vibrateTap();
              router.push("/worker/saleability");
            }}
          >
            <CheckCircle className="h-5 w-5" />
            <span className="text-xs">Saleability</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex-col gap-1"
            onClick={handleViewBatches}
          >
            <Package className="h-5 w-5" />
            <span className="text-xs">Batches</span>
          </Button>
        </div>

        {/* Recent Batches Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recent Batches</h2>
            <Link href="/worker/batches">
              <Button variant="ghost" size="sm" className="min-h-[44px]">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {batchesLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!batchesLoading && recentBatches.length === 0 && (
            <Card className="bg-muted/30">
              <CardContent className="py-6 text-center">
                <Package className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No batches yet</p>
              </CardContent>
            </Card>
          )}

          {!batchesLoading && recentBatches.length > 0 && (
            <div className="space-y-2">
              {recentBatches.map((batch) => (
                <Link key={batch.id} href={`/worker/batches/${batch.id}`}>
                  <Card className="transition-all active:scale-[0.98] hover:shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                              {batch.batchNumber}
                            </span>
                            {batch.status && (
                              <Badge variant={getStatusVariant(batch.status)} className="text-xs">
                                {batch.status}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-medium text-sm truncate">
                            {batch.varietyName || "Unknown Variety"}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {batch.locationName || "No location"}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-semibold">{batch.quantity.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">plants</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </PullToRefresh>
  );
}
