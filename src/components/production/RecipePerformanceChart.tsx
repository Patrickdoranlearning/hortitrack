"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Clock, Target, Leaf, AlertCircle } from "lucide-react";
import { useMemo } from "react";

type PerformanceData = {
  totalBatches: number;
  avgDurationDays: number | null;
  avgYieldPct: number | null;
  durationAccuracy: number | null;
  recentPerformance: Array<{
    batchId: string;
    completedAt: string;
    actualDurationDays: number | null;
    actualYieldPct: number | null;
  }>;
};

type Props = {
  protocolId: string;
  plannedDurationDays?: number;
};

export default function RecipePerformanceChart({ protocolId, plannedDurationDays }: Props) {
  const [data, setData] = React.useState<PerformanceData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const res = await fetch(`/api/production/protocols/${protocolId}/performance`);
        if (!res.ok) {
          throw new Error("Failed to load performance data");
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [protocolId]);

  // Calculate duration comparison
  const durationComparison = useMemo(() => {
    if (!data?.avgDurationDays || !plannedDurationDays) return null;
    const diff = data.avgDurationDays - plannedDurationDays;
    const pctDiff = Math.round((diff / plannedDurationDays) * 100);
    return {
      diff,
      pctDiff,
      isOnTrack: Math.abs(pctDiff) <= 10,
      isFaster: diff < 0,
    };
  }, [data?.avgDurationDays, plannedDurationDays]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Analytics
          </CardTitle>
          <CardDescription>Loading performance data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Performance Analytics
          </CardTitle>
          <CardDescription>Unable to load performance data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalBatches === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Analytics
          </CardTitle>
          <CardDescription>
            Track how batches using this recipe perform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Leaf className="h-12 w-12 mb-3 opacity-50" />
            <p className="font-medium">No performance data yet</p>
            <p className="text-sm mt-1">
              Data will appear here when batches using this recipe are completed.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Analytics
        </CardTitle>
        <CardDescription>
          Based on {data.totalBatches} completed batch{data.totalBatches !== 1 ? "es" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Duration */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Avg Duration
            </div>
            <div className="text-2xl font-bold">
              {data.avgDurationDays ?? "—"} days
            </div>
            {durationComparison && (
              <div className="flex items-center gap-1 text-sm">
                {durationComparison.isOnTrack ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    On track
                  </Badge>
                ) : durationComparison.isFaster ? (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    {Math.abs(durationComparison.diff)}d faster
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {durationComparison.diff}d longer
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Yield */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Leaf className="h-4 w-4" />
              Avg Yield
            </div>
            <div className="text-2xl font-bold">
              {data.avgYieldPct !== null ? `${data.avgYieldPct}%` : "—"}
            </div>
            {data.avgYieldPct !== null && (
              <div className="flex items-center gap-1 text-sm">
                {data.avgYieldPct >= 95 ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Excellent
                  </Badge>
                ) : data.avgYieldPct >= 85 ? (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Good
                  </Badge>
                ) : data.avgYieldPct >= 70 ? (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    Average
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    Needs review
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Accuracy */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Duration Accuracy
            </div>
            <div className="text-2xl font-bold">
              {data.durationAccuracy !== null ? `${data.durationAccuracy}%` : "—"}
            </div>
            {data.durationAccuracy !== null && (
              <p className="text-xs text-muted-foreground">
                How close to planned duration
              </p>
            )}
          </div>
        </div>

        {/* Recent Performance Mini-table */}
        {data.recentPerformance.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Recent Batches</h4>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">Completed</th>
                    <th className="text-right p-2 font-medium">Duration</th>
                    <th className="text-right p-2 font-medium">Yield</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPerformance.slice(0, 5).map((perf) => (
                    <tr key={perf.batchId} className="border-b last:border-0">
                      <td className="p-2">
                        {new Date(perf.completedAt).toLocaleDateString("en-IE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-2 text-right">
                        {perf.actualDurationDays ?? "—"} days
                      </td>
                      <td className="p-2 text-right">
                        {perf.actualYieldPct !== null
                          ? `${perf.actualYieldPct}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

