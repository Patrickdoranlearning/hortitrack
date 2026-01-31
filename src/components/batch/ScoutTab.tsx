"use client";

import * as React from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PlantHealthEvent } from "@/lib/history-types";
import { ScoutLogCard } from "@/components/batches/ScoutLogCard";
import { Bug, Loader2, Search, Plus } from "lucide-react";
import { fetchJson } from "@/lib/http";
import Link from "next/link";

interface ScoutTabProps {
  batchId: string;
  batchNumber?: string;
}

// Use the dedicated scout-logs API endpoint
const fetcher = async (url: string) => {
  const { data } = await fetchJson<{ scouts: PlantHealthEvent[] }>(url);
  return data?.scouts || [];
};

export function ScoutTab({ batchId, batchNumber }: ScoutTabProps) {
  const { data: scoutLogs = [], error, isLoading: loading, mutate } = useSWR(
    batchId ? `/api/production/batches/${batchId}/scout-logs` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Calculate summary
  const summary = React.useMemo(() => {
    if (scoutLogs.length === 0) return null;

    const bySeverity = scoutLogs.reduce((acc, log) => {
      const severity = log.severity?.toLowerCase() || 'unknown';
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byIssueType = scoutLogs.reduce((acc, log) => {
      const issueType = log.issueType || 'Other';
      acc[issueType] = (acc[issueType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { bySeverity, byIssueType, total: scoutLogs.length };
  }, [scoutLogs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-orange-500" />
            Scout Observations
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/plant-health/scout?batchId=${batchId}`}>
              <Plus className="h-4 w-4 mr-1" />
              Log Observation
            </Link>
          </Button>
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
            <span className="font-medium">{summary.total} observation{summary.total > 1 ? 's' : ''}</span>
            {summary.bySeverity.critical && (
              <Badge variant="destructive" className="text-[10px]">
                {summary.bySeverity.critical} critical
              </Badge>
            )}
            {summary.bySeverity.high && (
              <Badge variant="destructive" className="text-[10px] bg-red-500">
                {summary.bySeverity.high} high
              </Badge>
            )}
            {summary.bySeverity.medium && (
              <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800">
                {summary.bySeverity.medium} medium
              </Badge>
            )}
            {summary.bySeverity.low && (
              <Badge variant="outline" className="text-[10px] border-green-500 text-green-700">
                {summary.bySeverity.low} low
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading scout observations...
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 py-4">{String(error)}</div>
        )}
        {!loading && !error && scoutLogs.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            <Bug className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p>No scout observations recorded for this batch.</p>
            <p className="text-xs mt-1">Use the button above to log a new observation.</p>
          </div>
        )}
        {!loading && scoutLogs.length > 0 && (
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {scoutLogs.map((log) => (
              <ScoutLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ScoutTab;
