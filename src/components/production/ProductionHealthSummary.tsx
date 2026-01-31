"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";

interface HealthSummary {
  totalBatches: number;
  healthyBatches: number;
  attentionBatches: number;
  criticalBatches: number;
  unresolvedScoutsCount: number;
  upcomingTreatmentsCount: number;
  recentIssues: Array<{
    batchId: string;
    batchNumber: string;
    varietyName: string;
    severity: string;
    issueType: string;
    eventAt: string;
  }>;
}

const fetcher = async (url: string): Promise<HealthSummary> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch health summary");
  }
  return response.json();
};

interface ProductionHealthSummaryProps {
  className?: string;
}

export function ProductionHealthSummary({ className }: ProductionHealthSummaryProps) {
  const { data, error, isLoading } = useSWR(
    "/api/production/health-summary",
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
    }
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="h-5 w-5 text-emerald-600" />
            Plant Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="h-5 w-5 text-emerald-600" />
            Plant Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Unable to load health summary
          </div>
        </CardContent>
      </Card>
    );
  }

  const healthyPercent = data.totalBatches > 0
    ? Math.round((data.healthyBatches / data.totalBatches) * 100)
    : 100;

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case "high":
        return <Badge className="bg-red-100 text-red-700 text-xs">High</Badge>;
      case "medium":
        return <Badge className="bg-amber-100 text-amber-700 text-xs">Medium</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Low</Badge>;
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="h-5 w-5 text-emerald-600" />
            Plant Health Overview
          </CardTitle>
          <Link href="/plant-health">
            <Button variant="ghost" size="sm" className="text-xs">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>
          {healthyPercent}% of active batches are healthy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {data.healthyBatches}
            </div>
            <div className="text-xs text-muted-foreground">Healthy</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <div className="text-xl font-bold text-amber-700 dark:text-amber-400">
              {data.attentionBatches}
            </div>
            <div className="text-xs text-muted-foreground">Attention</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
            <AlertCircle className="h-5 w-5 mx-auto text-red-600 mb-1" />
            <div className="text-xl font-bold text-red-700 dark:text-red-400">
              {data.criticalBatches}
            </div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <Calendar className="h-5 w-5 mx-auto text-blue-600 mb-1" />
            <div className="text-xl font-bold text-blue-700 dark:text-blue-400">
              {data.upcomingTreatmentsCount}
            </div>
            <div className="text-xs text-muted-foreground">Scheduled</div>
          </div>
        </div>

        {/* Unresolved Issues */}
        {data.unresolvedScoutsCount > 0 && (
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              {data.unresolvedScoutsCount} unresolved scout observation{data.unresolvedScoutsCount !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Recent Issues */}
        {data.recentIssues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Recent Issues</h4>
            <div className="space-y-2">
              {data.recentIssues.slice(0, 3).map((issue, idx) => (
                <Link
                  key={`${issue.batchId}-${idx}`}
                  href={`/production/batches?batch=${issue.batchId}`}
                  className="block p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {issue.batchNumber}
                        </span>
                        {getSeverityBadge(issue.severity)}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {issue.varietyName}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(parseISO(issue.eventAt), { addSuffix: true })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {data.recentIssues.length > 3 && (
              <Link href="/plant-health">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  View all {data.recentIssues.length} issues
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* All Clear */}
        {data.criticalBatches === 0 && data.attentionBatches === 0 && data.unresolvedScoutsCount === 0 && (
          <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
            <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              All batches are healthy!
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              No issues requiring attention
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProductionHealthSummary;
