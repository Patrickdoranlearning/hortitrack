"use client";

import useSWR from "swr";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  Search,
  Bug,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";
import { useRouter } from "next/navigation";

interface ScoutLog {
  id: string;
  logType: "issue" | "reading" | "all_clear";
  issueType?: string;
  severity?: "low" | "medium" | "critical";
  ecReading?: number;
  phReading?: number;
  notes?: string;
  photoUrl?: string;
  recordedBy?: string;
  recordedByName?: string;
  createdAt: string;
}

interface BatchScoutHistoryProps {
  batchId: string;
}

async function fetchScoutLogs(url: string): Promise<{ logs: ScoutLog[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch scout logs");
  return res.json();
}

/**
 * Displays scout observation history for a batch.
 */
export function BatchScoutHistory({ batchId }: BatchScoutHistoryProps) {
  const router = useRouter();

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR(`/api/worker/batches/${batchId}/scouts`, fetchScoutLogs);

  const logs = data?.logs ?? [];

  const handleRefresh = () => {
    vibrateTap();
    mutate();
  };

  const handleStartScout = () => {
    vibrateTap();
    router.push(`/worker/scout/batch/${batchId}`);
  };

  const getLogIcon = (log: ScoutLog) => {
    if (log.logType === "all_clear") {
      return <CheckCircle2 className="h-5 w-5" />;
    }
    if (log.logType === "reading") {
      return <Gauge className="h-5 w-5" />;
    }
    return <Bug className="h-5 w-5" />;
  };

  const getLogColor = (log: ScoutLog) => {
    if (log.logType === "all_clear") {
      return "bg-green-100 text-green-600";
    }
    if (log.logType === "reading") {
      return "bg-cyan-100 text-cyan-600";
    }
    if (log.severity === "critical") {
      return "bg-red-100 text-red-600";
    }
    if (log.severity === "medium") {
      return "bg-amber-100 text-amber-600";
    }
    return "bg-blue-100 text-blue-600";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-3" />
        <h3 className="font-medium mb-1">Failed to load scout history</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {error.message}
        </p>
        <Button onClick={handleRefresh} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          className="flex-1 h-12"
          onClick={handleStartScout}
        >
          <Eye className="h-4 w-4 mr-2" />
          Scout Now
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12"
          onClick={handleRefresh}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Scout Observations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Scout Observations
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No scout observations yet</p>
              <p className="text-sm">Tap "Scout Now" to start</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex gap-3 pb-4 border-b last:border-0 last:pb-0"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      getLogColor(log)
                    )}
                  >
                    {getLogIcon(log)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {log.logType === "all_clear" ? (
                          <p className="font-medium text-green-700 dark:text-green-400">
                            All Clear
                          </p>
                        ) : log.logType === "reading" ? (
                          <div>
                            {log.ecReading !== undefined && (
                              <p className="font-medium">EC: {log.ecReading} mS/cm</p>
                            )}
                            {log.phReading !== undefined && (
                              <p className="font-medium">pH: {log.phReading}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="font-medium capitalize">{log.issueType || "Issue"}</p>
                            {log.severity && (
                              <Badge
                                variant={log.severity === "critical" ? "destructive" : "secondary"}
                                className="text-xs capitalize"
                              >
                                {log.severity}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {log.notes && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {log.notes}
                      </p>
                    )}

                    {log.photoUrl && (
                      <div className="mt-2">
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={log.photoUrl}
                            alt="Scout photo"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                            <Camera className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>
                        {formatDistanceToNow(parseISO(log.createdAt), { addSuffix: true })}
                      </span>
                      {log.recordedByName && (
                        <>
                          <span>by</span>
                          <span>{log.recordedByName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BatchScoutHistory;
