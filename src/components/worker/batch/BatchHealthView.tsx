"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  Heart,
  FlaskConical,
  Bug,
  Gauge,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Droplets,
  Clock,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";
import { useRouter } from "next/navigation";

interface HealthLog {
  id: string;
  event_type: string;
  event_at: string;
  product_name?: string;
  rate?: number;
  unit?: string;
  method?: string;
  ec_reading?: number;
  ph_reading?: number;
  issue_reason?: string;
  severity?: string;
  notes?: string;
}

interface BatchHealthViewProps {
  batchId: string;
}

async function fetchHealthLogs(url: string): Promise<{ logs: HealthLog[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch health logs");
  return res.json();
}

/**
 * Displays health history for a batch including treatments, measurements, and issues.
 */
export function BatchHealthView({ batchId }: BatchHealthViewProps) {
  const router = useRouter();

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR(`/api/worker/batches/${batchId}/health`, fetchHealthLogs);

  const logs = data?.logs ?? [];

  // Calculate summary stats
  const stats = useMemo(() => {
    const treatments = logs.filter((l) => l.event_type === "treatment").length;
    const issues = logs.filter((l) => l.event_type === "issue_flagged").length;
    const measurements = logs.filter((l) => l.event_type === "measurement").length;
    const lastTreatment = logs.find((l) => l.event_type === "treatment");
    const lastMeasurement = logs.find((l) => l.event_type === "measurement");

    return {
      treatments,
      issues,
      measurements,
      lastTreatment,
      lastMeasurement,
    };
  }, [logs]);

  const handleRefresh = () => {
    vibrateTap();
    mutate();
  };

  const handleStartScout = () => {
    vibrateTap();
    router.push(`/worker/scout/batch/${batchId}`);
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "treatment":
        return <FlaskConical className="h-4 w-4" />;
      case "issue_flagged":
        return <Bug className="h-4 w-4" />;
      case "measurement":
        return <Gauge className="h-4 w-4" />;
      case "all_clear":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Heart className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: string, severity?: string) => {
    if (eventType === "issue_flagged") {
      if (severity === "critical") return "bg-red-100 text-red-600";
      if (severity === "medium") return "bg-amber-100 text-amber-600";
      return "bg-blue-100 text-blue-600";
    }
    if (eventType === "treatment") return "bg-purple-100 text-purple-600";
    if (eventType === "measurement") return "bg-cyan-100 text-cyan-600";
    if (eventType === "all_clear") return "bg-green-100 text-green-600";
    return "bg-gray-100 text-gray-600";
  };

  const formatEventTitle = (log: HealthLog) => {
    switch (log.event_type) {
      case "treatment":
        return log.product_name || "Treatment Applied";
      case "issue_flagged":
        return log.issue_reason || "Issue Reported";
      case "measurement":
        const readings = [];
        if (log.ec_reading !== undefined) readings.push(`EC: ${log.ec_reading}`);
        if (log.ph_reading !== undefined) readings.push(`pH: ${log.ph_reading}`);
        return readings.length > 0 ? readings.join(", ") : "Measurement";
      case "all_clear":
        return "All Clear";
      default:
        return log.event_type;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-3" />
        <h3 className="font-medium mb-1">Failed to load health data</h3>
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
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <FlaskConical className="h-4 w-4 text-purple-500" />
              <span className="text-xl font-bold">{stats.treatments}</span>
            </div>
            <p className="text-xs text-muted-foreground">Treatments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Bug className="h-4 w-4 text-amber-500" />
              <span className="text-xl font-bold">{stats.issues}</span>
            </div>
            <p className="text-xs text-muted-foreground">Issues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Gauge className="h-4 w-4 text-cyan-500" />
              <span className="text-xl font-bold">{stats.measurements}</span>
            </div>
            <p className="text-xs text-muted-foreground">Readings</p>
          </CardContent>
        </Card>
      </div>

      {/* Last Readings Summary */}
      {stats.lastMeasurement && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              Latest Readings
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                {stats.lastMeasurement.ec_reading !== undefined && (
                  <p className="text-lg font-semibold">
                    EC: {stats.lastMeasurement.ec_reading} mS/cm
                  </p>
                )}
                {stats.lastMeasurement.ph_reading !== undefined && (
                  <p className="text-lg font-semibold">
                    pH: {stats.lastMeasurement.ph_reading}
                  </p>
                )}
              </div>
              <div className="text-right text-sm text-muted-foreground">
                {formatDistanceToNow(parseISO(stats.lastMeasurement.event_at), { addSuffix: true })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          className="flex-1 h-12"
          onClick={handleStartScout}
        >
          <Bug className="h-4 w-4 mr-2" />
          Scout Batch
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

      {/* Health History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Health History
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {logs.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Heart className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No health records yet</p>
              <p className="text-sm">Scout this batch to start tracking</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      getEventColor(log.event_type, log.severity)
                    )}
                  >
                    {getEventIcon(log.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm truncate">
                        {formatEventTitle(log)}
                      </p>
                      {log.severity && (
                        <Badge
                          variant={log.severity === "critical" ? "destructive" : "secondary"}
                          className="text-xs capitalize flex-shrink-0"
                        >
                          {log.severity}
                        </Badge>
                      )}
                    </div>
                    {log.event_type === "treatment" && log.rate && (
                      <p className="text-xs text-muted-foreground">
                        {log.rate} {log.unit} - {log.method}
                      </p>
                    )}
                    {log.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {log.notes}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(parseISO(log.event_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
              {logs.length > 10 && (
                <p className="text-center text-sm text-muted-foreground pt-2">
                  Showing 10 of {logs.length} records
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BatchHealthView;
