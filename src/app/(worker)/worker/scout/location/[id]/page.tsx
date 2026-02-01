"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Check,
  AlertTriangle,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess, vibrateError } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";
import type {
  WorkerLocationDetail,
  WorkerLocationBatch,
} from "@/app/api/worker/locations/[id]/route";

async function fetchLocation(url: string): Promise<WorkerLocationDetail> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Location not found");
    throw new Error("Failed to fetch location");
  }
  return res.json();
}

type BatchScoutStatus = "pending" | "clear" | "issue";

interface BatchWithStatus extends WorkerLocationBatch {
  scoutStatus: BatchScoutStatus;
}

export default function WorkerScoutLocationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const locationId = params.id as string;

  // Track scout status for each batch
  const [batchStatuses, setBatchStatuses] = useState<Record<string, BatchScoutStatus>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: location,
    error,
    isLoading,
  } = useSWR(`/api/worker/locations/${locationId}`, fetchLocation);

  // Batches with their scout status
  const batchesWithStatus: BatchWithStatus[] = useMemo(() => {
    if (!location?.batches) return [];
    return location.batches.map((batch) => ({
      ...batch,
      scoutStatus: batchStatuses[batch.id] || "pending",
    }));
  }, [location?.batches, batchStatuses]);

  // Summary counts
  const statusCounts = useMemo(() => {
    return batchesWithStatus.reduce(
      (acc, batch) => {
        acc[batch.scoutStatus]++;
        return acc;
      },
      { pending: 0, clear: 0, issue: 0 }
    );
  }, [batchesWithStatus]);

  const handleBack = () => {
    vibrateTap();
    router.back();
  };

  const handleMarkAllClear = async () => {
    vibrateTap();

    if (!location?.batches.length) return;

    setIsSubmitting(true);

    try {
      // Create a scout log for the location
      const response = await fetch("/api/worker/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          isAllClear: true,
          notes: `All ${location.batches.length} batches scouted - no issues`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      // Mark all batches as clear locally
      const newStatuses: Record<string, BatchScoutStatus> = {};
      for (const batch of location.batches) {
        newStatuses[batch.id] = "clear";
      }
      setBatchStatuses(newStatuses);

      vibrateSuccess();
      toast({
        title: "Location scouted",
        description: `All ${location.batches.length} batches marked as clear`,
      });
    } catch (err) {
      vibrateError();
      toast({
        variant: "destructive",
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchClick = (batch: WorkerLocationBatch) => {
    vibrateTap();
    // Navigate to individual batch scout page
    router.push(`/worker/scout/batch/${batch.id}`);
  };

  const handleToggleBatchClear = (batchId: string) => {
    vibrateTap();
    setBatchStatuses((prev) => {
      const current = prev[batchId] || "pending";
      // Cycle: pending -> clear -> pending
      return {
        ...prev,
        [batchId]: current === "clear" ? "pending" : "clear",
      };
    });
  };

  const handleComplete = async () => {
    vibrateTap();

    // Check if all batches have been addressed
    const pendingCount = statusCounts.pending;
    if (pendingCount > 0) {
      vibrateError();
      toast({
        variant: "destructive",
        title: "Incomplete",
        description: `${pendingCount} batch${pendingCount > 1 ? "es" : ""} still need to be scouted`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create a summary scout log for the location
      const clearedBatches = batchesWithStatus.filter((b) => b.scoutStatus === "clear");
      const issueBatches = batchesWithStatus.filter((b) => b.scoutStatus === "issue");

      const response = await fetch("/api/worker/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          isAllClear: issueBatches.length === 0,
          notes: `Location scout complete: ${clearedBatches.length} clear, ${issueBatches.length} with issues`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      vibrateSuccess();
      toast({
        title: "Scout complete",
        description: `${clearedBatches.length} clear, ${issueBatches.length} issues`,
      });

      router.back();
    } catch (err) {
      vibrateError();
      toast({
        variant: "destructive",
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: BatchScoutStatus) => {
    switch (status) {
      case "clear":
        return <Check className="h-5 w-5 text-green-600" />;
      case "issue":
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={handleBack} />
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !location) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={handleBack} />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">
            {error?.message || "Location not found"}
          </p>
          <Button onClick={handleBack} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header onBack={handleBack} title={`Scout ${location.name}`} />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Location Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <MapPin className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold">{location.name}</h2>
                <p className="text-sm text-muted-foreground truncate">
                  {[location.type, location.nurserySite].filter(Boolean).join(" - ") ||
                    "Nursery Location"}
                </p>
                <Badge variant="secondary" className="text-xs mt-1">
                  {location.batchCount} batch{location.batchCount !== 1 ? "es" : ""}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick All Clear Button */}
        <Button
          variant="outline"
          className={cn(
            "w-full h-14 text-lg border-2",
            statusCounts.pending === 0 && statusCounts.issue === 0
              ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20"
              : ""
          )}
          onClick={handleMarkAllClear}
          disabled={isSubmitting || location.batchCount === 0}
        >
          <CheckCircle2 className="h-5 w-5 mr-2" />
          Mark All Clear
        </Button>

        {/* Progress Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold text-muted-foreground">
              {statusCounts.pending}
            </div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <div className="text-lg font-bold text-green-600">{statusCounts.clear}</div>
            <div className="text-xs text-muted-foreground">Clear</div>
          </div>
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <div className="text-lg font-bold text-amber-600">{statusCounts.issue}</div>
            <div className="text-xs text-muted-foreground">Issues</div>
          </div>
        </div>

        {/* Batch Checklist */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Batches to Scout</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {batchesWithStatus.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No batches at this location
              </div>
            ) : (
              <div className="space-y-2">
                {batchesWithStatus.map((batch) => (
                  <div
                    key={batch.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      "transition-all touch-manipulation",
                      batch.scoutStatus === "clear" && "bg-green-50 border-green-200 dark:bg-green-900/20",
                      batch.scoutStatus === "issue" && "bg-amber-50 border-amber-200 dark:bg-amber-900/20"
                    )}
                  >
                    {/* Status toggle button */}
                    <button
                      type="button"
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        "border-2 transition-all active:scale-90",
                        batch.scoutStatus === "clear"
                          ? "bg-green-100 border-green-500"
                          : batch.scoutStatus === "issue"
                          ? "bg-amber-100 border-amber-500"
                          : "bg-muted border-muted-foreground/30"
                      )}
                      onClick={() => handleToggleBatchClear(batch.id)}
                      disabled={isSubmitting}
                    >
                      {getStatusIcon(batch.scoutStatus)}
                    </button>

                    {/* Batch info */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleBatchClick(batch)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          {batch.batchNumber}
                        </span>
                        {batch.healthStatus && batch.healthStatus !== "healthy" && (
                          <Badge
                            variant={batch.healthStatus === "critical" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {batch.healthStatus}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {batch.varietyName || "Unknown variety"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {batch.quantity.toLocaleString()} plants
                      </div>
                    </div>

                    {/* Log issue button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                      onClick={() => handleBatchClick(batch)}
                      disabled={isSubmitting}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complete Button */}
        <Button
          className="w-full h-14 text-lg"
          onClick={handleComplete}
          disabled={isSubmitting || statusCounts.pending > 0}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Complete Scout
            </>
          )}
        </Button>

        {statusCounts.pending > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {statusCounts.pending} batch{statusCounts.pending !== 1 ? "es" : ""} still pending
          </p>
        )}
      </div>
    </div>
  );
}

// Header component
function Header({
  onBack,
  title,
}: {
  onBack: () => void;
  title?: string;
}) {
  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] -ml-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="flex-1 text-center font-medium truncate px-4">
          {title || "Scout Location"}
        </h1>

        <div className="w-16" /> {/* Spacer for centering */}
      </div>
    </div>
  );
}
